// Bounded local checks. Starts only a loopback preview and Vite, then stops both.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as pause } from 'node:timers/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const children = [];
function start(binary, args) {
  const child = spawn(binary, args, { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, MAIL_ENABLED: '0' } });
  child.on('error', () => {});
  children.push(child);
  return child;
}
async function waitFor(url, child) {
  for (let i = 0; i < 40; i++) {
    if (child.exitCode !== null) throw new Error('Local verification server could not start. Check port availability.');
    try { await fetch(url, { signal: AbortSignal.timeout(1000) }); return; } catch { await pause(250); }
  }
  throw new Error('Local verification server did not become ready.');
}
async function check(url, expected, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, expected, `${new URL(url).pathname}: expected ${expected}, received ${response.status}`);
  return response;
}
try {
  const preview = start('C:\\xampp\\php\\php.exe', ['-S','127.0.0.1:18965','-t','dist','scripts/local/preview-router.php']);
  await waitFor('http://127.0.0.1:18965/', preview);
  await check('http://127.0.0.1:18965/', 200);
  await check('http://127.0.0.1:18965/admin', 200, { headers: { Accept: 'text/html' } });
  for (const path of ['/.env','/phpmyadmin/','/.git/config','/src/main.jsx','/includes/shared/database.php','/vendor/autoload.php','/composer.lock','/AGENTS.md']) {
    await check(`http://127.0.0.1:18965${path}`, 404, { headers: { Accept: 'text/html' } });
  }
  await check('http://127.0.0.1:18965/api/admin/notifications.php', 401);
  await check('http://127.0.0.1:18965/api/admin/notifications.php', 401, { method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"test"}' });
  await check('http://127.0.0.1:18965/api/admin/notifications.php', 405, { method:'DELETE' });
  const vite = start(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','18966','--strictPort']);
  await waitFor('http://127.0.0.1:18966/', vite);
  const health = await check('http://127.0.0.1:18966/api/hello.php', 200);
  assert.equal((await health.json()).status, 'success');
  await check('http://127.0.0.1:18966/api/admin/notifications.php', 401);
  for (const path of ['/vendor/autoload.php','/composer.lock','/.env','/includes/notifications/transport.php']) {
    await check(`http://127.0.0.1/odidepse_beachresort${path}`, 403);
  }
  console.log('Passed local preview protected-file denial, notification API auth/method checks, Apache protection and Vite-to-PHP proxy checks.');
} finally {
  await Promise.all(children.map(async child => { if (child.exitCode === null) { child.kill(); await Promise.race([once(child, 'exit'), pause(3000)]); } }));
}
