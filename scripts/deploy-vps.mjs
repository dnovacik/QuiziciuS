#!/usr/bin/env node
// Builds the app on this machine and deploys it to the VPS behind https://quiz.cognision.eu:
// the web app as static files for nginx, the API as the quizicius-api systemd service.
// Each deploy is a new release folder; the previous ones stay for a quick rollback.
//
//   pnpm deploy:vps
//   DEPLOY_HOST=other-ssh-alias pnpm deploy:vps
//
// The one-time server setup and rollback are in docs/DEPLOY_VPS.md.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = process.env.DEPLOY_HOST || 'cognision-vps';
const STAGE = join(ROOT, '.deploy');
const RELEASE = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const isWindows = process.platform === 'win32';

const log = (message) => console.log(`\x1b[35m[deploy]\x1b[0m ${message}`);
function run(label, command, args, options = {}) {
  log(label);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: isWindows, ...options });
  if (result.status !== 0) {
    console.error(`\x1b[31m[deploy] ${label} failed\x1b[0m`);
    process.exit(1);
  }
}
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const webEnv = existsSync(join(ROOT, 'apps/web/.env')) ? readFileSync(join(ROOT, 'apps/web/.env'), 'utf8') : '';
if (!/^VITE_SUPABASE_URL=.+/m.test(webEnv) || !/^VITE_SUPABASE_ANON_KEY=.+/m.test(webEnv)) {
  console.error('\x1b[31m[deploy] apps/web/.env needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\x1b[0m');
  process.exit(1);
}

run('building shared types', 'pnpm', ['--filter', '@quizicius/shared-types', 'build']);
run('building the API', 'pnpm', ['--filter', 'api', 'build']);
// The browser reaches the API through the same address as the app (nginx forwards /api).
run('building the web app', 'pnpm', ['--filter', 'web', 'build'], { env: { ...process.env, VITE_API_URL: '/api' } });

log('staging the release');
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(join(STAGE, 'api/shared-types'), { recursive: true });
cpSync(join(ROOT, 'apps/api/dist'), join(STAGE, 'api/dist'), { recursive: true });
cpSync(join(ROOT, 'packages/shared-types/dist'), join(STAGE, 'api/shared-types/dist'), { recursive: true });
const shared = readJson(join(ROOT, 'packages/shared-types/package.json'));
writeFileSync(
  join(STAGE, 'api/shared-types/package.json'),
  JSON.stringify({ name: shared.name, version: shared.version, main: shared.main, types: shared.types }, null, 2),
);
// Pin each dependency to the version installed (and tested) here; the server installs them.
const api = readJson(join(ROOT, 'apps/api/package.json'));
const dependencies = Object.fromEntries(
  Object.keys(api.dependencies).map((name) =>
    name === shared.name
      ? [name, 'file:./shared-types']
      : [name, readJson(join(ROOT, 'apps/api/node_modules', name, 'package.json')).version],
  ),
);
writeFileSync(join(STAGE, 'api/package.json'), JSON.stringify({ name: 'quizicius-api', private: true, dependencies }, null, 2));
cpSync(join(ROOT, 'apps/web/dist'), join(STAGE, 'web'), { recursive: true });

const archive = `quizicius-${RELEASE}.tgz`;
run('packing', 'tar', ['-czf', archive, '-C', STAGE, 'api', 'web']);
run(`uploading to ${HOST}`, 'scp', ['-q', archive, `${HOST}:/tmp/${archive}`]);
rmSync(join(ROOT, archive));

const remote = `
set -euo pipefail
API=/opt/quizicius/releases/${RELEASE}
WEB=/var/www/quiz.cognision.eu/releases/${RELEASE}
mkdir -p "$API" "$WEB"
UNPACK=$(mktemp -d)
tar -xzf /tmp/${archive} -C "$UNPACK" && rm /tmp/${archive}
mv "$UNPACK"/api/* "$API"/ && mv "$UNPACK"/web/* "$WEB"/ && rm -rf "$UNPACK"
cd "$API" && npm install --omit=dev --no-audit --no-fund --loglevel=error
ln -sfn "$API" /opt/quizicius/current
ln -sfn "$WEB" /var/www/quiz.cognision.eu/current
systemctl restart quizicius-api
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/categories || true)
  [ "$code" = 401 ] && break
  sleep 1
done
[ "$code" = 401 ] || { echo "API did not come up (HTTP $code)"; journalctl -u quizicius-api -n 30 --no-pager; exit 1; }
# Keep the three newest releases of each.
for dir in /opt/quizicius/releases /var/www/quiz.cognision.eu/releases; do
  ls -1dt "$dir"/*/ | tail -n +4 | xargs -r rm -rf
done
echo "release ${RELEASE} is live"
`;
run('installing on the server', 'ssh', [HOST, 'bash -s'], { input: remote, stdio: ['pipe', 'inherit', 'inherit'], shell: false });
rmSync(STAGE, { recursive: true, force: true });
log('done: https://quiz.cognision.eu');
