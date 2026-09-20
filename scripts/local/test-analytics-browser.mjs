import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const php = 'C:/xampp/php/php.exe';
const browserPath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const base = 'http://127.0.0.1:5173';
const session = JSON.parse(execFileSync(php, ['scripts/local/analytics-test-session.php'], { encoding: 'utf8', windowsHide: true }));
const profile = await mkdtemp(path.join(tmpdir(), 'odidepse-analytics-browser-'));
let browser, socket;
try {
  const cookie = `odidepse_admin=${session.session_id}`;
  const api = async (endpoint, options = {}) => {
    const response = await fetch(`${base}/api/admin/${endpoint}`, { ...options, headers: { Cookie: cookie, Accept: 'application/json', ...(options.headers || {}) } });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await fetch(`${base}/api/admin/analytics.php`)).status, 401, 'Unauthenticated analytics');
  assert.equal((await fetch(`${base}/api/admin/booking-finance.php?booking_id=1`)).status, 401, 'Unauthenticated finance');
  assert.equal((await api('analytics.php', { method: 'DELETE' })).status, 405, 'Method restriction');
  assert.equal((await api('analytics.php?source=invalid')).status, 422, 'Filter validation');
  assert.equal((await api('analytics-insights.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403, 'AI CSRF');
  assert.equal((await api('booking-finance.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403, 'Finance CSRF');
  const report = await api('analytics.php');
  assert.equal(report.status, 200, 'Authenticated analytics through Vite proxy');
  assert.equal(report.body.analytics.forecast.daily.length, 30);
  const bookings = await api('bookings.php'); assert.equal(bookings.status, 200);
  const id = Number(bookings.body.bookings[0]?.id);
  assert.ok(id, 'Existing local booking for read-only finance smoke test');
  assert.equal((await api(`booking-finance.php?booking_id=${id}`)).status, 200);
  const pendingBooking = bookings.body.bookings.find(booking => booking.status === 'pending' && booking.agreed_total === null);
  if (pendingBooking) {
    assert.equal((await api('bookings.php', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf_token }, body: JSON.stringify({ id: Number(pendingBooking.id), status: 'confirmed' }) })).status, 422, 'Missing total blocks confirmation server-side');
  }
  assert.equal((await api('booking-finance.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf_token }, body: JSON.stringify({ booking_id: id, revision: -1, action: 'set_total', amount: '0.00', reason: 'Never written: stale revision test' }) })).status, 409, 'Revision check before mutation');

  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let port;
  for (let i = 0; i < 60; i++) {
    try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await new Promise(resolve => setTimeout(resolve, 150)); }
  }
  assert.ok(port, 'Headless browser available');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0; const pending = new Map(); const errors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    const task = pending.get(message.id);
    if (task) { pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error(`Browser condition timed out: ${expression}. Analytics state: ${await evaluate("document.querySelector('.analytics-page')?.innerText.slice(0, 1200) || 'Page not mounted'")}`);
  };
  await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Network.setCookie', { name: 'odidepse_admin', value: session.session_id, url: base, httpOnly: true, sameSite: 'Strict' });
  await send('Page.navigate', { url: `${base}/admin` });
  await waitFor("Boolean(document.querySelector('button[title=Analytics]'))");
  await evaluate("document.querySelector('button[title=Analytics]').click()");
  await waitFor("Boolean(document.querySelector('.analytics-kpis'))");
  if (process.argv.includes('--mock')) {
    assert.equal(report.body.analytics.mock_available, true, 'Local mock feature enabled');
    assert.equal((await api('analytics-mock.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403, 'Mock generation CSRF');
    await evaluate("[...document.querySelectorAll('.analytics-actions button')].find(button => button.textContent === 'Generate mock data').click()");
    await waitFor("Boolean(document.querySelector('.analytics-kpis')) && document.querySelector('.analytics-quality').innerText.includes('synthetic bookings')");
    assert.ok(await evaluate("!document.querySelector('.analytics-forecast').innerText.includes('Insufficient history')"), 'Mock history enables trained forecast');
    assert.equal(await evaluate("document.querySelectorAll('.analytics-kpis button').length"), 0, 'Mock records cannot open real bookings');
    await evaluate("[...document.querySelectorAll('.analytics-actions button')].find(button => button.textContent === 'Use real data').click()");
    await waitFor("Boolean(document.querySelector('.analytics-kpis button')) && !document.body.innerText.includes('Mock data · testing only')");
    assert.deepEqual((await api('bookings.php')).body.bookings, bookings.body.bookings, 'Generating mock data never changes real bookings');
  }
  for (const width of [1440, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: false });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), `No page overflow at ${width}px`);
    assert.equal(await evaluate("document.querySelectorAll('.analytics-kpis article').length"), 8);
  }
  assert.ok(await evaluate("document.querySelector('.analytics-forecast').innerText.includes('Insufficient history')"));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('.analytics-kpis button').click()");
  await waitFor("Boolean(document.querySelector('.booking-subnav'))");
  assert.ok(await evaluate("document.body.innerText.includes('Analytics filter:')"));
  if (pendingBooking) {
    await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'Clear analytics filter')?.click()");
    await evaluate("[...document.querySelectorAll('.booking-status-action')].find(button => button.textContent === 'Confirm')?.click()");
    await waitFor("Boolean(document.querySelector('.booking-finance-dialog[open] .booking-finance__totals'))");
    assert.ok(await evaluate("document.querySelector('.booking-finance-dialog .booking-finance-confirm').disabled"), 'Finance modal requires total');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 850, deviceScaleFactor: 1, mobile: false });
    assert.ok(await evaluate("document.querySelector('.booking-finance-dialog').scrollWidth <= document.querySelector('.booking-finance-dialog').clientWidth + 1"), 'Finance modal fits mobile');
    await evaluate("document.querySelector('.booking-finance-dialog button[aria-label=\"Close finance\"]').click()");
  }
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('Passed authenticated API/Vite proxy, method/filter/CSRF/revision/confirmation checks, analytics rendering at desktop/tablet/mobile, booking drill-through and finance modal. No external AI call or booking changes.');
} finally {
  socket?.close();
  if (browser) { browser.kill(); await new Promise(resolve => { browser.once('exit', resolve); setTimeout(resolve, 1500); }); }
  execFileSync(php, ['scripts/local/analytics-test-session.php', 'destroy', session.session_id], { stdio: 'ignore', windowsHide: true });
  // Only the exact directory created by mkdtemp, never a workspace or profile root.
  if (profile.startsWith(path.join(tmpdir(), 'odidepse-analytics-browser-'))) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
