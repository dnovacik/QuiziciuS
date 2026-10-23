#!/usr/bin/env node
// One command for a live quiz night from this laptop: builds the app, starts the API, serves the
// built web app on port 5199 and opens an ngrok tunnel to it. Ctrl+C stops everything.
//
//   pnpm live                               # random ngrok address
//   pnpm live -- --domain my-pub.ngrok-free.app
//   NGROK_DOMAIN=my-pub.ngrok-free.app pnpm live
//
// See docs/LIVE_NIGHT.md.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = 3000;
const WEB_PORT = 5199;
const isWindows = process.platform === 'win32';
const domainArg = process.argv.find((arg) => arg.startsWith('--domain'));
const domain = (domainArg?.includes('=') ? domainArg.split('=')[1] : domainArg && process.argv[process.argv.indexOf(domainArg) + 1]) || process.env.NGROK_DOMAIN || '';

const children = [];
const log = (message) => console.log(`\x1b[35m[live]\x1b[0m ${message}`);
const fail = (message) => {
  console.error(`\x1b[31m[live] ${message}\x1b[0m`);
  stopAll(1);
};

function stopAll(code = 0) {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // On Windows a shell-spawned process tree is only stopped with taskkill.
    if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  process.exit(code);
}
process.on('SIGINT', () => {
  log('stopping…');
  stopAll(0);
});

function run(label, command, args, options = {}) {
  log(`${label}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: isWindows, ...options });
  if (result.status !== 0) fail(`${label} failed`);
}

function start(label, command, args, options = {}) {
  const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: isWindows, ...options });
  const prefix = `\x1b[36m[${label}]\x1b[0m `;
  child.stdout.on('data', (data) => process.stdout.write(prefix + String(data).replace(/\n(?=.)/g, `\n${prefix}`)));
  child.stderr.on('data', (data) => process.stderr.write(prefix + String(data).replace(/\n(?=.)/g, `\n${prefix}`)));
  child.on('exit', (code) => {
    if (code !== null && code !== 0) fail(`${label} stopped (exit ${code})`);
  });
  children.push(child);
  return child;
}

const portFree = (port) =>
  new Promise((resolve) => {
    const server = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => server.close(() => resolve(true)))
      .listen(port);
  });

async function waitFor(label, check, seconds = 60) {
  for (let i = 0; i < seconds * 2; i++) {
    try {
      const value = await check();
      if (value) return value;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`${label} did not start within ${seconds} s`);
}

// ---------- checks ----------
const webEnv = readFileSync(join(ROOT, 'apps/web/.env'), 'utf8');
if (!/^VITE_API_URL=\/api\s*$/m.test(webEnv)) {
  fail('apps/web/.env must contain VITE_API_URL=/api, so phones reach the API through the tunnel');
}
if (spawnSync('ngrok', ['version'], { shell: isWindows }).status !== 0) {
  fail('ngrok is not installed or not on PATH (https://ngrok.com/download), then: ngrok config add-authtoken <token>');
}
if (!(await portFree(WEB_PORT))) fail(`port ${WEB_PORT} is busy — stop the dev server (pnpm dev) first`);
const reuseApi = !(await portFree(API_PORT));

// ---------- build ----------
run('build shared types', 'pnpm', ['--filter', '@quizicius/shared-types', 'build']);
if (!reuseApi) run('build API', 'pnpm', ['--filter', 'api', 'build']);
run('build web app', 'pnpm', ['--filter', 'web', 'build']);

// ---------- start ----------
if (reuseApi) log(`an API is already running on port ${API_PORT} — using it`);
else start('api', 'node', ['dist/main.js'], { cwd: join(ROOT, 'apps/api') });
await waitFor('API', async () => (await fetch(`http://localhost:${API_PORT}/api/sessions/by-code/ZZZZ`)).status === 404);
log('API is up');

start('web', 'pnpm', ['--filter', 'web', 'exec', 'vite', 'preview']);
await waitFor('web app', async () => (await fetch(`http://localhost:${WEB_PORT}/`)).ok);
log('web app is up');

start('ngrok', 'ngrok', ['http', String(WEB_PORT), '--log=stdout', '--log-level=warn', ...(domain ? [`--url=https://${domain}`] : [])]);
const publicUrl = await waitFor('ngrok tunnel', async () => {
  const { tunnels } = await (await fetch('http://127.0.0.1:4040/api/tunnels')).json();
  return tunnels.find((tunnel) => tunnel.public_url.startsWith('https://'))?.public_url;
});

console.log(`
\x1b[32m  QuiziciuS is live\x1b[0m

  Host (open THIS address, so the join QR is right):  ${publicUrl}/host
  Players join at:                                     ${publicUrl}/play
  Projector: open it from the control room ("Otvoriť projektor")

  Free ngrok: each browser sees "You are about to visit…" once — tap "Visit Site".
  Keep the laptop on power and awake. Ctrl+C stops everything.
`);
