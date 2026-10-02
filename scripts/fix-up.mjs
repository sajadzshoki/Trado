import { Client } from 'ssh2'

const password = process.env.DEPLOY_SSH_PASSWORD
const HOST = '188.121.107.118'

function connectOnce() {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn
      .on('ready', () => resolve(conn))
      .on('error', reject)
      .connect({ host: HOST, port: 22, username: 'root', password, readyTimeout: 60000 })
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
      console.error(err.message)
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
  throw last
}

function exec(conn, command, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    console.log(`$ ${command}`)
    conn.exec(command, { pty: true }, (err, stream) => {
      if (err) return reject(err)
      let stdout = ''
      const timer = setTimeout(() => {
        stream.close()
        reject(new Error('timeout'))
      }, timeoutMs)
      stream.on('data', (d) => {
        stdout += d.toString()
        process.stdout.write(d)
      })
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => {
        clearTimeout(timer)
        resolve({ code: code ?? 0, stdout })
      })
    })
  })
}

async function main() {
  const conn = await connect()
  await exec(conn, 'docker images --format "{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}" | grep -iE "postgres|node" || true')
  // Retry pull; if alpine fails, fall back to postgres:16
  let pull = await exec(conn, 'docker pull postgres:16-alpine', 300000)
  if (pull.code !== 0) {
    console.log('alpine pull failed, trying postgres:16')
    pull = await exec(conn, 'docker pull postgres:16', 300000)
    if (pull.code === 0) {
      // rewrite compose image on server
      await exec(
        conn,
        "sed -i 's|image: postgres:16-alpine|image: postgres:16|' /root/projects/trado/docker-compose.yml && grep -n postgres /root/projects/trado/docker-compose.yml",
      )
    }
  }
  await exec(conn, 'cd /root/projects/trado && docker compose -p trado up -d', 600000)

  // follow logs until listening
  await new Promise((resolve) => {
    conn.exec('cd /root/projects/trado && docker compose -p trado logs -f --no-color app', { pty: true }, (err, stream) => {
      if (err) return resolve()
      let buf = ''
      const timer = setTimeout(() => {
        stream.close()
        resolve()
      }, 600000)
      stream.on('data', (d) => {
        const s = d.toString()
        buf += s
        process.stdout.write(s)
        const lower = buf.toLowerCase()
        if (/listening/.test(lower) || /nitro.*ready/.test(lower) || /server started/.test(lower)) {
          clearTimeout(timer)
          stream.close()
          resolve()
        }
      })
      stream.on('close', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  })

  await exec(conn, 'sleep 3')
  await exec(conn, 'cd /root/projects/trado && docker compose -p trado ps')
  await exec(conn, 'curl -sS -o /tmp/trado_health.txt -w "HTTP:%{http_code}\\n" http://127.0.0.1:3010/api/health || true')
  await exec(conn, 'cat /tmp/trado_health.txt || true')
  await exec(conn, 'curl -sS -o /dev/null -w "EXT:%{http_code}\\n" http://188.121.107.118:3010/api/health || true')
  await exec(conn, 'curl -sS -o /dev/null -w "HOME:%{http_code}\\n" http://127.0.0.1:3010/ || true')
  await exec(conn, 'cd /root/projects/trado && docker compose -p trado ps --format "{{.Name}} {{.Service}} {{.Status}}"')
  await exec(conn, 'cd /root/projects/trado && docker compose -p trado logs --no-color --tail=80 app')
  conn.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
