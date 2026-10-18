// Start the actual server entry point and run the original card-flow regression.
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');

module.exports = async function runFullFlow(databaseEnv) {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const env = { ...databaseEnv, PORT: String(port), NODE_ENV: 'production', TRUST_PROXY: 'false',
    CARD_PEPPER: crypto.randomBytes(32).toString('hex'), CARD_OFFLINE_HOURS: '0',
    LICENSE_SIGNING_KEY: crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex'),
    BACKUP_ENABLED: 'false', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', REDIS_URL: '',
    WEBHOOK_ALLOW_HTTP: 'true', WEBHOOK_DOMAIN_ALLOWLIST: '', E2E_BASE: `http://127.0.0.1:${port}` };
  const server = spawn(process.execPath, [path.join(__dirname, '../server/src/index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', data => { logs = (logs + data).slice(-8000); });
  const exited = new Promise(resolve => server.once('exit', resolve));
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error('Server exited during startup');
      try {
        const health = await fetch(env.E2E_BASE + '/health', { signal: AbortSignal.timeout(1000) });
        if (health.ok) { ready = true; break; }
      } catch { /* server is starting */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error('Actual server failed readiness check');
    console.log('Actual server ready; running original card-flow regression');
    const test = spawn(process.execPath, [path.join(__dirname, 'test-card-flow.js')], { env, stdio: 'inherit' });
    const code = await new Promise((resolve, reject) => { test.once('error', reject); test.once('exit', resolve); });
    if (code !== 0) throw new Error('Original card-flow regression failed');
  } catch (err) { console.error(logs); throw err; }
  finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    const timer = setTimeout(() => server.kill('SIGKILL'), 10000);
    await exited;
    clearTimeout(timer);
  }
};
