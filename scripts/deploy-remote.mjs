import { Client } from 'ssh2'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, posix } from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'

const HOST = '188.121.107.118'
const PORT = 22
const USER = 'root'
const PASSWORD = process.env.DEPLOY_SSH_PASSWORD
const NAME = 'trado'
const REMOTE_DIR = `/root/projects/${NAME}`
const LOCAL_ROOT = process.cwd()

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.nuxt',
  '.output',
  '.data',
  'dist',
  'coverage',
  '.drizzle',
  '.vscode',
])
const SKIP_FILES = new Set(['.env', '.DS_Store'])

if (!PASSWORD) {
  console.error('DEPLOY_SSH_PASSWORD is required')
  process.exit(1)
}

function connectOnce() {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn
      .on('ready', () => resolve(conn))
      .on('error', reject)
      .connect({
        host: HOST,
        port: PORT,
        username: USER,
        password: PASSWORD,
        readyTimeout: 60000,
        keepaliveInterval: 15000,
      })
  })
}

async function connect(retries = 8) {
  let last
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`SSH attempt ${i}/${retries}...`)
      return await connectOnce()
    } catch (err) {
      last = err
      console.error(`SSH failed: ${err.message}`)
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
  throw last
}

function exec(conn, command, { timeoutMs = 120000, quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!quiet) console.log(`$ ${command}`)
    conn.exec(command, { pty: true }, (err, stream) => {
      if (err) return reject(err)
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        stream.close()
        reject(new Error(`timeout after ${timeoutMs}ms: ${command}`))
      }, timeoutMs)
      stream.on('data', (d) => {
        const s = d.toString()
        stdout += s
        process.stdout.write(s)
      })
      stream.stderr.on('data', (d) => {
        const s = d.toString()
        stderr += s
        process.stderr.write(s)
      })
      stream.on('close', (code) => {
        clearTimeout(timer)
        resolve({ code: code ?? 0, stdout, stderr })
      })
    })
  })
}

function sftpOpen(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)))
  })
}

function sftpMkdir(sftp, path) {
  return new Promise((resolve) => {
    sftp.mkdir(path, () => resolve())
  })
}

function sftpWrite(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const rs = createReadStream(localPath)
    const ws = sftp.createWriteStream(remotePath)
    ws.on('close', resolve)
    ws.on('error', reject)
    rs.on('error', reject)
    rs.pipe(ws)
  })
}

function sftpWriteString(sftp, content, remotePath) {
  return new Promise((resolve, reject) => {
    const ws = sftp.createWriteStream(remotePath)
    ws.on('close', resolve)
    ws.on('error', reject)
    ws.end(content)
  })
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue
    if (name.endsWith('.log') || name.endsWith('.tsbuildinfo')) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

function pickFreePort(used) {
  const candidates = [3001, 3002, 3003, 3010, 3020, 3030, 3100, 3200, 4000, 5000, 8080, 8081, 8088]
  for (const p of candidates) {
    if (!used.has(p) && p !== 3000 && p !== 9000) return p
  }
  for (let p = 3101; p < 3999; p++) {
    if (!used.has(p)) return p
  }
  throw new Error('no free port found')
}

async function ensureRemoteDirs(sftp, fileRelPaths) {
  const dirs = new Set([REMOTE_DIR])
  for (const rel of fileRelPaths) {
    const parts = rel.split(/[\\/]/).slice(0, -1)
    let cur = REMOTE_DIR
    for (const part of parts) {
      cur = posix.join(cur, part)
      dirs.add(cur)
    }
  }
  const sorted = [...dirs].sort((a, b) => a.length - b.length)
  for (const d of sorted) await sftpMkdir(sftp, d)
}

async function main() {
  console.log(`Connecting to ${HOST}...`)
  const conn = await connect()
  console.log('SSH ready')

  // Inspect ports / containers without touching projects-hub
  const ps = await exec(conn, 'docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"')
  const ss = await exec(conn, "ss -lptn | awk 'NR==1 || /LISTEN/'")
  const used = new Set()
  for (const m of `${ps.stdout}\n${ss.stdout}`.matchAll(/:(\d{2,5})(?!\d)/g)) {
    used.add(Number(m[1]))
  }
  // also parse docker published ports like 0.0.0.0:3000->
  for (const m of ps.stdout.matchAll(/0\.0\.0\.0:(\d+)/g)) used.add(Number(m[1]))
  for (const m of ps.stdout.matchAll(/:::(\d+)/g)) used.add(Number(m[1]))

  const hostPort = pickFreePort(used)
  console.log(`Selected host port: ${hostPort}`)

  await exec(conn, `mkdir -p ${REMOTE_DIR}`)

  const files = walk(LOCAL_ROOT)
  const rels = files.map((f) => relative(LOCAL_ROOT, f).replace(/\\/g, '/'))
  console.log(`Uploading ${files.length} files to ${REMOTE_DIR}...`)
  const sftp = await sftpOpen(conn)
  await ensureRemoteDirs(sftp, rels)
  for (let i = 0; i < files.length; i++) {
    const rel = rels[i]
    const remote = posix.join(REMOTE_DIR, rel)
    await sftpWrite(sftp, files[i], remote)
    if ((i + 1) % 25 === 0 || i === files.length - 1) {
      console.log(`  uploaded ${i + 1}/${files.length}`)
    }
  }

  const pgPass = randomBytes(18).toString('base64url')
  const sessionPass = randomBytes(32).toString('hex')
  const envContent = [
    `POSTGRES_USER=trado`,
    `POSTGRES_PASSWORD=${pgPass}`,
    `POSTGRES_DB=trado`,
    `DATABASE_URL=postgres://trado:${pgPass}@postgres:5432/trado`,
    `NUXT_SESSION_PASSWORD=${sessionPass}`,
    `NUXT_AUTO_MIGRATE=true`,
    `APP_HOST_PORT=${hostPort}`,
    `HOST=0.0.0.0`,
    `PORT=3000`,
    `NITRO_HOST=0.0.0.0`,
    `NITRO_PORT=3000`,
    `NODE_ENV=production`,
    '',
  ].join('\n')

  await sftpWriteString(sftp, envContent, posix.join(REMOTE_DIR, '.env'))
  console.log('.env written on server (secrets not printed)')
  sftp.end()

  // Bring up stack
  await exec(
    conn,
    `cd ${REMOTE_DIR} && docker compose -p ${NAME} up -d --pull always`,
    { timeoutMs: 600000 },
  )

  // Follow app logs until ready or hard failure
  console.log('Following app logs...')
  const logResult = await new Promise((resolve, reject) => {
    conn.exec(
      `cd ${REMOTE_DIR} && docker compose -p ${NAME} logs -f --no-color app`,
      { pty: true },
      (err, stream) => {
        if (err) return reject(err)
        let buf = ''
        let done = false
        const finish = (ok, reason) => {
          if (done) return
          done = true
          clearTimeout(timer)
          stream.close()
          resolve({ ok, reason, buf })
        }
        const timer = setTimeout(() => finish(false, 'log-timeout-10m'), 600000)
        stream.on('data', (d) => {
          const s = d.toString()
          buf += s
          process.stdout.write(s)
          const lower = buf.toLowerCase()
          if (
            /listening.*[: ]3000/.test(lower) ||
            /listening on/.test(lower) ||
            /nitro.*ready/.test(lower) ||
            /server listening/.test(lower) ||
            /➜\s*local:/.test(buf) ||
            /listening on http/i.test(buf)
          ) {
            finish(true, 'ready')
          }
          // hard crash loops
          if (/cannot find module/.test(lower) && /error/.test(lower)) {
            // wait a bit more; build may still be running
          }
          if (/npm err!/.test(lower) && /errno/.test(lower) && buf.includes('npm run build')) {
            // build failure often ends with exit
          }
        })
        stream.stderr.on('data', (d) => process.stderr.write(d.toString()))
        stream.on('close', () => finish(false, 'stream-closed'))
      },
    )
  })

  // Give nitro a moment after "listening"
  await exec(conn, 'sleep 3', { quiet: true })

  const status = await exec(conn, `cd ${REMOTE_DIR} && docker compose -p ${NAME} ps`)
  const localCurl = await exec(
    conn,
    `curl -sS -o /tmp/trado_health.txt -w "%{http_code}" http://127.0.0.1:${hostPort}/api/health || true`,
  )
  const healthBody = await exec(conn, 'cat /tmp/trado_health.txt || true', { quiet: true })
  const externalCurl = await exec(
    conn,
    `curl -sS -o /tmp/trado_ext.txt -w "%{http_code}" http://188.121.107.118:${hostPort}/api/health || true`,
  )
  const homeCurl = await exec(
    conn,
    `curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:${hostPort}/ || true`,
  )

  // real container name
  const nameOut = await exec(
    conn,
    `cd ${REMOTE_DIR} && docker compose -p ${NAME} ps --format "{{.Name}} {{.Service}} {{.Status}}"`,
  )

  console.log('\n=== DEPLOY SUMMARY (safe) ===')
  console.log(`stack=${NAME}`)
  console.log(`remote_dir=${REMOTE_DIR}`)
  console.log(`host_port=${hostPort}`)
  console.log(`log_ready=${logResult.ok} reason=${logResult.reason}`)
  console.log(`local_health_code=${localCurl.stdout.trim()} body=${healthBody.stdout.trim()}`)
  console.log(`external_health_code=${externalCurl.stdout.trim()}`)
  console.log(`home_code=${homeCurl.stdout.trim()}`)
  console.log(`containers:\n${nameOut.stdout}`)

  // If not healthy, dump recent logs for diagnosis (no secrets expected)
  if (!String(localCurl.stdout).includes('200')) {
    await exec(conn, `cd ${REMOTE_DIR} && docker compose -p ${NAME} logs --no-color --tail=120 app`)
    await exec(conn, `cd ${REMOTE_DIR} && docker compose -p ${NAME} logs --no-color --tail=40 postgres`)
  }

  conn.end()
  // Write a local summary file without secrets for the assistant
  process.stdout.write(`\nHOST_PORT=${hostPort}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
