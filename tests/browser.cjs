/* SPDX-License-Identifier: Apache-2.0
 * Run real theme modules and view against synthetic read-only RPC fixtures.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const staticRoots = ['luci-theme-zcop', 'luci-app-zcop-dashboard'].map(p => path.join(root, p, 'htdocs'));
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
const bootstrap = process.env.LUCI_BOOTSTRAP_CSS;
if (!bootstrap) throw Error('Set LUCI_BOOTSTRAP_CSS to an installed/bootstrap source cascade.css');

const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/luci-static/zcop/cascade.css"><script src="/luci-static/zcop/palette.js"></script></head><body class="zcop-theme"><div class="zcop-layout"><aside id="mainmenu" class="zcop-sidebar"><a class="zcop-brand" href="/"><img src="/luci-static/zcop/logo.svg" width="30" height="30" alt=""><span>CR881x<small>Router control</small></span></a><nav id="topmenu"></nav><div class="zcop-sidebar-bottom"><div class="zcop-palettes"><button data-zcop-palette="light">Light</button><button data-zcop-palette="dark">Dark</button><button data-zcop-palette="luxury">Luxury</button></div></div></aside><main id="maincontent" class="zcop-main"><div class="zcop-command"><button class="zcop-menu-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button><nav id="tabmenu"></nav><div id="indicators"></div></div><div class="zcop-content"><div id="view"></div></div><footer class="zcop-footer"><span>Synthetic RPC fixture · no router connection</span><span>Zcop theme</span></footer></main></div></body></html>`;

const server = http.createServer((req, res) => {
 const pathname = new URL(req.url, 'http://localhost').pathname;
 if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end(fixture); return; }
 let file;
 if (pathname === '/luci-static/bootstrap/cascade.css') file = bootstrap;
 else for (const base of staticRoots) {
  const candidate = path.resolve(base, '.' + pathname);
  if (candidate.startsWith(base + path.sep) && fs.existsSync(candidate)) { file = candidate; break; }
 }
 if (!file) { res.statusCode = 404; res.end(); return; }
 res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/javascript');
 res.end(fs.readFileSync(file));
});

(async () => {
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const browser = await chromium.launch({ headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('http://127.0.0.1:' + server.address().port);
  const read = name => fs.readFileSync(path.join(root, name), 'utf8');
  const sources = {
   menu: read('luci-theme-zcop/htdocs/luci-static/resources/menu-zcop.js'),
   metrics: read('luci-app-zcop-dashboard/htdocs/luci-static/resources/zcop/metrics.js'),
   scheduler: read('luci-app-zcop-dashboard/htdocs/luci-static/resources/zcop/scheduler.js'),
   dashboard: read('luci-app-zcop-dashboard/htdocs/luci-static/resources/view/zcop/dashboard.js')
  };
  await page.evaluate(async sources => {
   window._ = s => s;
   window.E = (tag, attrs, children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
     if (typeof value === 'function') node.addEventListener(key, value);
     else if (value != null) node.setAttribute(key, value);
    }
    const append = value => { if (Array.isArray(value)) value.forEach(append); else if (value != null) node.append(value instanceof Node ? value : document.createTextNode(String(value))); };
    append(children); return node;
   };
   const child = (title, children = {}, more = {}) => ({ title, children, satisfied: true, ...more });
   window.tree = { children: { admin: child('Administration', {
    status: child('Status', { zcop_dashboard: child('Dashboard'), overview: child('Overview'), hidden: child('Denied', {}, { satisfied: false }) }),
    network: child('Network', { network: child('Interfaces'), wireless: child('Wireless'), cr881x_yt921x_qos: child('QoS'), plugin: child('Third-party app', { detail: child('Deep settings') }) }),
    system: child('System', { system: child('System') }),
    services: child('Services', { application: child('Installed application') }), logout: child('Log out')
   }) } };
   window.ui = { menu: { load: async () => tree, getChildren: node => Object.entries(node.children || {}).filter(([, n]) => n.satisfied && n.title).map(([name, n]) => ({ ...n, name })) } };
   window.L = { env: { dispatchpath: ['admin', 'status', 'zcop_dashboard'] }, url: (...args) => '/cgi-bin/luci/' + args.join('/'), resource: p => '/luci-static/resources/' + p, resolveDefault: (p, fallback) => p.catch(() => fallback) };
   const baseclass = { extend: object => object }, view = baseclass;
   window.fixture = { hidden: false, calls: [], wanDevice: 'wan', down: false, fail: false, optional: false };
   Object.defineProperty(document, 'hidden', { configurable: true, get: () => fixture.hidden });
   const rpc = { declare: options => async (...args) => {
    const key = options.object + '.' + options.method; fixture.calls.push({ key, args, time: Date.now() });
    if (fixture.fail) throw Error('fixture unavailable');
    let data;
    if (key === 'system.info') data = { uptime: 187200, memory: { total: 170917888, available: 36280729 } };
    else if (key === 'system.board') data = { model: 'CR881x · synthetic fixture' };
    else if (key === 'network.interface.dump') data = { interface: [{ interface: 'wan', up: !fixture.down, l3_device: fixture.wanDevice, proto: 'dhcp' }] };
    else if (key === 'network.device.status') data = { statistics: { rx_bytes: Math.floor(Date.now() / 1000 * 10300000), tx_bytes: Math.floor(Date.now() / 1000 * 1600000) } };
    else if (key === 'luci-rpc.getNetworkDevices') data = Object.fromEntries(['wan','lan1','lan2','lan3'].map(n => [n, { link: { carrier: n === 'wan' || n === 'lan3', speed: 1000 } }]));
    else if (key === 'luci-rpc.getWirelessDevices') data = { radio0: { up: true, iwinfo: { channel: 1 }, interfaces: [{ config: { ssid: 'Fixture 2.4 GHz' } }] }, radio1: { up: true, iwinfo: { channel: 36 }, interfaces: [{ config: { ssid: 'Fixture 5 GHz' } }] } };
    else if (key === 'luci-rpc.getDHCPLeases') data = { dhcp_leases: Array(8).fill({}), dhcp6_leases: Array(3).fill({}) };
    else if (key === 'luci.getMountPoints') data = { result: [{ mount: '/overlay', free: 30 * 1048576, avail: 29 * 1048576 }] };
    else if (key === 'file.read') {
     if (args[0] === '/proc/stat') data = { data: 'cpu  ' + Math.floor(Date.now() / 100) + ' 0 0 ' + Math.floor(Date.now() / 10) + ' 0 0 0 0 0 0\n' };
     else { if (fixture.optional) throw Error('optional counter unavailable'); data = { data: '48\n' }; }
    }
    if (data === undefined) throw Error('Unexpected RPC ' + key);
    const expected = Object.entries(options.expect || {})[0];
    return expected && expected[0] ? data[expected[0]] : data;
   } };
   window.menu = new Function('baseclass','ui',sources.menu)(baseclass,ui); menu.__init__();
   const metrics = new Function(sources.metrics)();
   const Scheduler = new Function(sources.scheduler)();
   window.dashboard = new Function('view','rpc','metrics','Scheduler',sources.dashboard)(view,rpc,metrics,Scheduler);
   document.querySelector('#view').append(dashboard.render(await dashboard.load()));
   document.dispatchEvent(new Event('luci-loaded'));
   await dashboard.scheduler.refresh();
  }, sources);
  await page.clock.runFor(5000);
  await page.evaluate(() => dashboard.scheduler.refresh());
  await page.clock.runFor(5000);
  await page.evaluate(() => dashboard.scheduler.refresh());
  assert.equal(await page.locator('.zc-widget').count(), 6);
  assert.equal(await page.locator('.zc-datum').filter({ hasText: 'Writable storage free' }).innerText(), 'Writable storage free\n29.0 MiB');
  assert.match(await page.locator('.zc-traffic-values').innerText(), /82\.4 Mbps/);
  assert.equal(await page.getByRole('link', { name: 'Denied' }).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Traffic control', exact: true }).count(), 1);
  await page.clock.runFor(300000);
  await page.evaluate(() => dashboard.scheduler.refresh());
  assert.equal(await page.evaluate(() => dashboard.history.length), 60, 'graph history is not bounded');
  assert.ok(await page.evaluate(() => dashboard.cpuBusy > 0 && dashboard.cpuBusy < 100), 'CPU time sampling failed');
  const tabGeometry = await page.getByRole('link', { name: 'Dashboard', exact: true }).evaluate(e => ({ link: e.getBoundingClientRect().height, row: e.parentElement.getBoundingClientRect().height }));
  assert.ok(tabGeometry.row >= tabGeometry.link, 'menu link is vertically clipped');
  for (const mode of ['light','dark','luxury']) {
   await page.locator(`[data-zcop-palette="${mode}"]`).click();
   await page.screenshot({ path: path.join(output, 'live-fixture-' + mode + '.png'), fullPage: true });
  }
  await page.evaluate(() => { L.env.dispatchpath = ['admin','network','plugin','detail']; document.querySelector('#topmenu').replaceChildren(); document.querySelector('#tabmenu').replaceChildren(); menu.render(tree); });
  assert.equal(await page.getByRole('link', { name: 'Third-party app', exact: true }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'Deep settings', exact: true }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'QoS', exact: true }).count(), 0, 'QoS duplicated inside Network');
  await page.evaluate(() => { L.env.dispatchpath = ['admin','network','cr881x_yt921x_qos']; document.querySelector('#topmenu').replaceChildren(); document.querySelector('#tabmenu').replaceChildren(); menu.render(tree); });
  assert.equal(await page.locator('.zcop-navitem.active').innerText(), '◇\nTraffic control');
  assert.match(await page.getByRole('link', { name: 'QoS', exact: true }).getAttribute('href'), /admin\/network\/cr881x_yt921x_qos$/);
  await page.evaluate(() => { L.env.dispatchpath = ['admin','status','zcop_dashboard']; document.querySelector('#topmenu').replaceChildren(); document.querySelector('#tabmenu').replaceChildren(); menu.render(tree); });
  const beforeHidden = await page.evaluate(() => { fixture.hidden = true; document.dispatchEvent(new Event('visibilitychange')); return fixture.calls.length; });
  await page.clock.runFor(60000);
  assert.equal(await page.evaluate(() => fixture.calls.length), beforeHidden, 'hidden page polled');
  await page.evaluate(() => { fixture.hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(10);
  await page.evaluate(() => dashboard.scheduler.refresh());
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const beforePause = await page.evaluate(() => fixture.calls.length);
  await page.clock.runFor(60000);
  assert.equal(await page.evaluate(() => fixture.calls.length), beforePause, 'paused page polled');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(10);
  await page.evaluate(() => dashboard.scheduler.refresh());
  await page.getByRole('combobox', { name: 'Refresh interval' }).selectOption('0');
  await page.evaluate(async () => { fixture.optional = true; dashboard.due = {}; await dashboard.scheduler.refresh(); });
  assert.match(await page.locator('.zc-widget').first().innerText(), /Unavailable/);
  await page.evaluate(async () => { fixture.fail = true; dashboard.due = {}; await dashboard.scheduler.refresh(); });
  assert.match(await page.locator('.zc-refresh-status').innerText(), /unavailable or stale/);
  assert.match(await page.locator('.zc-traffic-values').innerText(), /— Mbps/);
  await page.evaluate(async () => { fixture.fail = false; dashboard.due = {}; await dashboard.scheduler.refresh(); });
  for (const [width,height] of [[1366,650],[1536,720],[1920,850],[768,1024],[390,844]]) {
   await page.setViewportSize({ width,height });
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'page overflow at ' + width);
  }
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  assert.equal(await page.getByRole('button', { name: 'Toggle navigation' }).getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Toggle navigation' }).getAttribute('aria-expanded'), 'false');
  await page.screenshot({ path: path.join(output, 'live-fixture-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: actual modules, ACL/deep menus, metric units, hidden/paused/manual modes, unavailable data, 3 palettes and responsive layouts');
 } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
