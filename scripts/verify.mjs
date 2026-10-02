import { Client } from 'ssh2'

const password = process.env.DEPLOY_SSH_PASSWORD

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn
      .on('ready', () => resolve(conn))
      .on('error', reject)
      .connect({ host: '188.121.107.118', port: 22, username: 'root', password, readyTimeout: 60000 })
  })
}

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    console.log(`$ ${command}`)
    conn.exec(command, { pty: true }, (err, stream) => {
      if (err) return reject(err)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => resolve(code ?? 0))
    })
  })
}

async function main() {
  let conn
  for (let i = 1; i <= 6; i++) {
    try {
      console.log(`SSH ${i}`)
      conn = await connect()
      break
    } catch (e) {
      console.error(e.message)
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
  if (!conn) throw new Error('ssh failed')
  await exec(conn, 'docker inspect trado-app-1 --format "{{json .NetworkSettings.Networks}}"')
  await exec(conn, 'docker inspect trado-app-1 --format "name={{.Name}} restart={{.HostConfig.RestartPolicy.Name}}"')
  await exec(conn, 'docker inspect trado-postgres-1 --format "name={{.Name}} restart={{.HostConfig.RestartPolicy.Name}} health={{.State.Health.Status}}"')
  await exec(conn, 'cd /root/projects/trado && docker compose -p trado ps -a')
  await exec(conn, 'ls -la /root/projects/trado | head -40')
  await exec(conn, 'test -f /root/projects/trado/.env && echo ENV_OK || echo ENV_MISSING')
  await exec(conn, 'curl -sS -D- -o /dev/null http://127.0.0.1:3010/api/health | head -20')
  conn.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
