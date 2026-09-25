import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const php = 'C:/xampp/php/php.exe';
const base = 'http://127.0.0.1:5173';
const session = JSON.parse(execFileSync(php, ['scripts/local/analytics-test-session.php'], { encoding: 'utf8', windowsHide: true }));
const profile = await mkdtemp(path.join(tmpdir(), 'odidepse-report-smoke-'));
let browser, socket;
try {
  const api = async (route, options = {}) => {
    const response = await fetch(`${base}/api/admin/${route}`, { ...options, signal: AbortSignal.timeout(10000), headers: { Cookie: `odidepse_admin=${session.session_id}`, Accept: 'application/json', ...(options.headers || {}) } });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await fetch(`${base}/api/admin/analytics.php`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/booking-finance.php`)).status, 401);
  assert.equal((await api('analytics.php',{method:'DELETE'})).status,405);
  assert.equal((await api('analytics.php?source=invalid')).status,422);
  assert.equal((await api('booking-finance.php',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  const report=await api('analytics.php'); assert.equal(report.status,200);
  const bookings=await api('bookings.php'); assert.equal(bookings.status,200);
  const id=Number(bookings.body.bookings[0]?.id); assert.ok(id);
  assert.equal((await api(`booking-finance.php?booking_id=${id}`)).status,200);
  assert.equal((await api('booking-finance.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf_token},body:JSON.stringify({booking_id:id,revision:-1,action:'set_total',amount:'0.00',reason:'Stale request, must never be written'})})).status,409);
  browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
  let port;
  for(let i=0;i<60;i++){try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await new Promise(r=>setTimeout(r,150));}}
  assert.ok(port,'Headless Chrome available');
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0; const pending=new Map(); const errors=[];
  socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);const task=pending.get(msg.id);if(task){pending.delete(msg.id);msg.error?task.reject(new Error(msg.error.message)):task.resolve(msg.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error(`Timed out: ${expression}`);};
  await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCookie',{name:'odidepse_admin',value:session.session_id,url:base,httpOnly:true,sameSite:'Strict'});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`${base}/admin`});
  await waitFor("Boolean(document.querySelector('button[title=Analytics]'))");
  await evaluate("document.querySelector('button[title=Analytics]').click()");
  await waitFor("Boolean(document.querySelector('.bi-kpis')) && !document.querySelector('.bi-results.is-stale')");
  assert.equal(await evaluate("document.querySelectorAll('.bi-kpi').length"),8);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth+1'),'Desktop fits');
  const liveValue = await evaluate("document.querySelector('.bi-kpi strong').textContent");
  await evaluate("document.querySelector('.bi-mock-button').click()");
  await waitFor("Boolean(document.querySelector('.bi-mock-banner'))");
  assert.notEqual(await evaluate("document.querySelector('.bi-kpi strong').textContent"),liveValue,'Mock values replace live values');
  assert.equal(await evaluate("document.querySelector('.bi-toolbar button:nth-last-child(2)').disabled"),true,'Mock CSV export disabled');
  assert.equal(await evaluate("document.querySelector('.bi-toolbar button:last-child').disabled"),true,'Mock print disabled');
  assert.ok(await evaluate("[...document.querySelectorAll('.bi-panel table tbody th')].some(cell => cell.textContent === document.querySelector('.bi-filters select[name=stay_id] option:nth-child(2)')?.textContent)"),'Mock accommodation uses catalog name');
  await evaluate("[...document.querySelectorAll('.bi-toolbar button')].find(button => button.textContent === 'Show live data').click()");
  await waitFor("!document.querySelector('.bi-mock-banner')");
  assert.equal(await evaluate("document.querySelector('.bi-kpi strong').textContent"),liveValue,'Live report restored');
  const screenshot=await send('Page.captureScreenshot',{format:'png'});
  const imagePath=path.join(profile,'analytics-desktop.png'); await writeFile(imagePath,Buffer.from(screenshot.data,'base64'));
  await send('Emulation.setEmulatedMedia',{media:'print'});
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.bi-toolbar')).display"),'none','Print hides actions');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.admin-sidebar')).display"),'none','Print hides navigation');
  await send('Emulation.setEmulatedMedia',{media:''});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:850,deviceScaleFactor:1,mobile:false});
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth+1'),'Mobile fits');
  await evaluate("document.querySelector('.admin-mobile-nav button[title=Bookings]').click()");
  await waitFor("Boolean(document.querySelector('.booking-request-view, .booking-card'))");
  const viewOpened=await evaluate("(()=>{const b=[...document.querySelectorAll('.booking-card button')].find(b=>/view/i.test(b.textContent));if(b){b.click();return true;}return false;})()");
  if(viewOpened){await waitFor("Boolean(document.querySelector('.booking-finance__totals'))");assert.ok(await evaluate("document.querySelector('.admin-request-modal').scrollWidth <= document.querySelector('.admin-request-modal').clientWidth+1"),'Finance modal fits');assert.ok(await evaluate("(()=>{const main=document.querySelector('.admin-request-modal__main');const cards=[...main.children];return cards.findIndex(card=>card.textContent.includes('Request details'))<cards.findIndex(card=>card.classList.contains('request-contact'))&&cards.findIndex(card=>card.classList.contains('request-contact'))<cards.findIndex(card=>card.classList.contains('admin-request-modal__status'));})()"),'Contact and status follow request details');}
  assert.deepEqual(errors,[],'No browser runtime exceptions');
  console.log(`Passed authenticated API/proxy, authorization, CSRF, stale finance revision, desktop/mobile analytics and print layout. Screenshot: ${imagePath}`);
} finally {
  socket?.close(); if(browser)browser.kill();
  execFileSync(php,['scripts/local/analytics-test-session.php','destroy',session.session_id],{stdio:'ignore',windowsHide:true});
}
