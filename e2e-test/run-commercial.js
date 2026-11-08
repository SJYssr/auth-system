// Disposable MySQL acceptance runner. Does not read project .env or touch existing databases.
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const name = `auth-commercial-${crypto.randomBytes(5).toString('hex')}`;
const dbName = `auth_system_acceptance_${crypto.randomBytes(5).toString('hex')}`;
const password = crypto.randomBytes(24).toString('hex');
const env = { ...process.env, MYSQL_ROOT_PASSWORD: password };
function docker(args, options = {}) {
  const r = spawnSync('docker', args, { encoding: 'utf8', env, ...options });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(r.stderr || 'Docker command failed');
  return r.stdout.trim();
}
let created = false;
(async () => {
  try {
    if (process.env.E2E_COMMERCIAL_UI === '1') {
      const build = spawnSync('npm', ['run', 'build'], { cwd: path.join(__dirname, '../client'), stdio: 'inherit' });
      if (build.status !== 0) throw new Error('Frontend build failed');
    }
    docker(['info', '--format', '{{.ServerVersion}}']);
    docker(['run', '-d', '--name', name, '-e', 'MYSQL_ROOT_PASSWORD', '-p', '127.0.0.1::3306', 'mysql:8.0']);
    created = true;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const r = spawnSync('docker', ['exec', name, 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "SELECT 1"'], { encoding: 'utf8', timeout: 5000 });
      if (r.status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error('Disposable MySQL failed readiness check');
    const port = Number(docker(['port', name, '3306/tcp']).split(':').pop());
    let schema = fs.readFileSync(path.join(__dirname, '../server/schema.sql'), 'utf8').replaceAll('`auth-system`', `\`${dbName}\``);
    if (process.env.E2E_LEGACY_SCHEMA === '1') schema = schema.split('-- Duplicate legacy card licenses')[0];
    docker(['exec', '-i', name, 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4'], { input: schema });
    console.log('Disposable MySQL ready; running real HTTP + database acceptance');
    const databaseEnv = { ...process.env, DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'root', DB_PASSWORD: password, DB_NAME: dbName };
    const r = spawnSync(process.execPath, [path.join(__dirname, 'test-commercial.js')], { stdio: 'inherit', env: databaseEnv });
    process.exitCode = r.status ?? 1;
    if (r.status === 0 && process.env.E2E_FULL_FLOW === '1') await require('./run-full-flow')(databaseEnv);
  } finally {
    if (created) docker(['rm', '-f', name]);
  }
})().catch(err => { console.error(err.message); process.exitCode = 1; });
