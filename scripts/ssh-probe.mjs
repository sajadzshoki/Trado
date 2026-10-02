import { Client } from 'ssh2'

const password = process.env.DEPLOY_SSH_PASSWORD
if (!password) {
  console.error('missing password')
  process.exit(1)
}

const c = new Client()
const t = Date.now()
c.on('ready', () => {
  console.log('READY', Date.now() - t)
  c.exec('hostname; docker ps --format "{{.Names}}\t{{.Ports}}"', (e, s) => {
    if (e) {
      console.error(e)
      process.exit(2)
    }
    s.on('data', (d) => process.stdout.write(d))
    s.stderr.on('data', (d) => process.stderr.write(d))
    s.on('close', () => {
      c.end()
      process.exit(0)
    })
  })
})
  .on('error', (e) => {
    console.error('ERR', e.message)
    process.exit(2)
  })
  .connect({
    host: '188.121.107.118',
    port: 22,
    username: 'root',
    password,
    readyTimeout: 45000,
  })
