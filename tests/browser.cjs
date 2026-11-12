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

const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/luci-static/zcop/cascade.css"><script src="/luci-static/zcop/palette.js"></script></head><body class="zcop-theme"><div class="zcop-layout"><aside id="mainmenu" class="zcop-sidebar"><a class="zcop-brand" href="/"><img src="/luci-static/zcop/logo.svg" width="30" height="30" alt=""><span>CR881x<small>Router control</small></span></a><nav id="topmenu"></nav><div class="zcop-sidebar-bottom"><div class="zcop-palettes"><button data-zcop-palette="light">Light</button><button data-zcop-palette="dark">Dark</button><button data-zcop-palette="luxury">Luxury</button></div></div></aside><main id="maincontent" class="zcop-main"><div class="zcop-command"><button class="zcop-menu-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button><nav id="tabmenu"></nav><a class="zcop-password-notice" href="/cgi-bin/luci/admin/system/admin"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M7 1 13 12H1Z"/><path d="M7 4v4m0 2v.1"/></svg><span>No password set</span></a><div id="indicators"><span>Refreshing</span></div></div><div class="zcop-content"><div id="view"></div><footer class="zcop-footer"><span>Synthetic RPC fixture · no router connection</span><span>Zcop theme</span></footer></div></main></div></body></html>`;

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
    status: child('Status', { zcop_dashboard: child('Dashboard'), overview: child('Overview'), routesj:child('Routing'), nftables:child('Firewall'), logs:child('System Log',{syslog:child('System Log'),dmesg:child('Kernel Log')},{action:{type:'alias',path:'admin/status/logs/syslog'}}),processes:child('Processes'),channel_analysis:child('Channel Analysis'),wireguard:child('WireGuard'),realtime:child('Realtime Graphs'),custom_monitor:child('App monitor',{details:child('Monitor details')}),custom_alias:child('App alias',{}, {action:{type:'alias',path:'admin/network/plugin'}}),hidden: child('Denied', {}, { satisfied: false }) }),
    network: child('Network', { network: child('Interfaces'), wireless: child('Wireless'), diagnostics:child('Diagnostics'), cr881x_yt921x_qos: child('QoS'), plugin: child('Third-party app', { detail: child('Deep settings') }) }),
    system: child('System', { system: child('System') }),
    services: child('Services', { application: child('Installed application') }), logout: child('Log out')
   }) } };
   for(const [name,order]of Object.entries({status:10,system:20,network:50,services:60,logout:999}))tree.children.admin.children[name].order=order;
   window.originalMenuJSON=JSON.stringify(tree,(key,value)=>key==='name'?undefined:value);
   window.renderMenu=path=>{L.env.dispatchpath=path;document.querySelector('#topmenu').replaceChildren();document.querySelector('#tabmenu').replaceChildren();menu.render(tree);};
   window.ui = { menu: { load: async () => tree, getChildren: node => Object.entries(node.children || {}).filter(([,n])=>n.satisfied && Object.hasOwn(n,'title')).map(([name,n])=>{
    n.name=name;
    if(n.action?.path&&['alias','rewrite'].includes(n.action.type)){
     let target=tree;for(const part of n.action.path.split('/'))target=target?.children?.[part];
     if(target)return {...n,children:target.children,action:target.action};
    }
    return n;
   }).sort((a,b)=>(a.order??1000)-(b.order??1000)||a.name.localeCompare(b.name)) } };

   window.L = { env: { dispatchpath: ['admin', 'status', 'zcop_dashboard'] }, url: (...args) => '/cgi-bin/luci/' + args.join('/'), resource: p => '/luci-static/resources/' + p, resolveDefault: (p, fallback) => p.catch(() => fallback) };
   class Base { constructor() { if (this.__init__) this.__init__(); } }
   Base.extend = properties => { class Module extends Base {} Object.assign(Module.prototype, properties); return Module; };
   const baseclass = Base, view = Base;
   const instantiate = Module => {
    if (typeof Module !== 'function' || !(Module.prototype instanceof Base)) throw Error('Invalid LuCI baseclass export');
    return new Module();
   };
   window.fixture = { hidden: false, calls: [], wanDevice: 'wan', down: false, fail: false, optional: false, overrides: {} };
   Object.defineProperty(document, 'hidden', { configurable: true, get: () => fixture.hidden });
   const rpc = { declare: options => async (...args) => {
    const key = options.object + '.' + options.method; fixture.calls.push({ key, args, time: Date.now() });
    if (fixture.fail) throw Error('fixture unavailable');
    let data;
    if (key === 'system.info') data = { uptime: 187200, memory: { total: 170917888, available: 36280729 } };
    else if (key === 'system.board') data = { model:'CR881x · synthetic fixture',hostname:'router-fixture',system:'ARMv8',kernel:'6.18.60',release:{distribution:'OpenWrt',version:'SNAPSHOT',revision:'test-build',target:'qualcommax/ipq50xx'} };
    else if (key === 'network.interface.dump') data = { interface: [{ interface:'lan',up:true,l3_device:'br-lan',proto:'static','ipv4-address':[{address:'192.0.2.1'}] }, { interface: 'wan', up: !fixture.down, l3_device: fixture.wanDevice, proto: 'dhcp', 'ipv4-address': [{address:'192.0.2.2'}] }] };
    else if (key === 'network.device.status') data = { statistics: { rx_bytes: Math.floor(Date.now() / 1000 * 10300000), tx_bytes: Math.floor(Date.now() / 1000 * 1600000) } };
    else if (key === 'luci-rpc.getNetworkDevices') data = Object.fromEntries(['wan','lan1','lan2','lan3'].map(n => [n, { link: { carrier: n === 'wan' || n === 'lan3', speed: 1000 } }]));
    else if (key === 'luci-rpc.getWirelessDevices') data = { radio0: { up: true, iwinfo: { channel: 1, frequency:2412 }, interfaces: [{ config: { ssid: 'Fixture 2.4 GHz' } }] }, radio1: { up: true, iwinfo: { channel: 36, frequency:5180 }, interfaces: [{ config: { ssid: 'Fixture 5 GHz' } }] } };
    else if (key === 'luci-rpc.getDHCPLeases') data = { dhcp_leases: Array(8).fill({}), dhcp6_leases: Array(3).fill({}) };
    else if (key === 'luci.getMountPoints') data = { result: [{ mount: '/overlay', size:64 * 1048576, free: 30 * 1048576, avail: 29 * 1048576 }] };
    else if (key === 'file.read') {
     if (args[0] === '/proc/cpuinfo') data = {data:'processor : 0\nmodel name : ARMv8 Processor rev 4 (v8l)\nCPU architecture: 8\nCPU revision: 4\n'};
     else if (args[0] === '/sys/devices/system/cpu/present') data = {data:'0-1\n'};
     else if (args[0] === '/sys/devices/system/cpu/cpufreq/policy0/cpuinfo_max_freq') data = {data:'1200000\n'};
     else if (args[0] === '/proc/stat') data = { data: 'cpu  ' + Math.floor(Date.now() / 100) + ' 0 0 ' + Math.floor(Date.now() / 10) + ' 0 0 0 0 0 0\ncpu0 1 0 0 1\ncpu1 1 0 0 1\n' };
     else { if (fixture.optional) throw Error('optional counter unavailable'); data = { data: '48\n' }; }
    }
    if (Object.hasOwn(fixture.overrides, key)) data = fixture.overrides[key];
    if (data === undefined) throw Error('Unexpected RPC ' + key);
    const expected = Object.entries(options.expect || {})[0];
    return expected && expected[0] ? data[expected[0]] : data;
   } };
   window.menu = instantiate(new Function('baseclass','ui',sources.menu)(baseclass,ui));
   const metrics = instantiate(new Function('baseclass',sources.metrics)(baseclass));
   const Scheduler = instantiate(new Function('baseclass',sources.scheduler)(baseclass));
   window.dashboard = instantiate(new Function('view','rpc','metrics','Scheduler',sources.dashboard)(view,rpc,metrics,Scheduler));
   document.querySelector('#view').append(dashboard.render(await dashboard.load()));
   document.dispatchEvent(new Event('luci-loaded'));
   await dashboard.scheduler.refresh();
  }, sources);
  assert.equal(await page.getByRole('heading',{name:'Overview',exact:true}).count(),0);
  assert.equal(await page.locator('.zc-dashboard-host-footer .zc-dashboard-controls').count(),1);
  assert.match(await page.locator('.zc-specs').innerText(),/ARMv8 - 2 cores - 1\.20 GHz max/);
  const pendingCPU = await page.locator('.zc-cpu').boundingBox();
  const pendingRAM = await page.locator('.zc-memory').boundingBox();
  assert.match(await page.locator('.zc-cpu').innerText(), /Waiting for the next CPU sample/);
  assert.equal(await page.locator('.zc-traffic-empty').innerText(), 'Waiting for traffic samples');
  assert.equal(await page.locator('.zc-traffic-values strong').allTextContents().then(v=>v.join(',')), '—,—');
  await page.clock.runFor(5000);
  await page.evaluate(() => dashboard.scheduler.refresh());
  await page.clock.runFor(5000);
  await page.evaluate(() => dashboard.scheduler.refresh());
  assert.deepEqual(await page.locator('#tabmenu a').allTextContents(), ['Dashboard']);
  assert.equal(await page.locator('.zcop-command .zcop-password-notice').count(),1);
  assert.equal(await page.locator('.zcop-content .zcop-password-notice').count(),0);
  assert.match(await page.locator('.zcop-password-notice').getAttribute('href'),/admin\/system\/admin$/);
  assert.equal(await page.evaluate(()=>!!tree.children.admin.children.status.children.overview),true,'original registered menu tree was changed');
  assert.equal(await page.locator('.zc-section').count(), 7);
  assert.equal(await page.locator('.zc-connection .zc-state').innerText(), 'WAN up');
  assert.match(await page.locator('.zc-addresses').innerText(), /192\.0\.2\.2/);
  assert.equal(await page.locator('.zc-radio-heading strong').allTextContents().then(v=>v.join(',')), '2.4 GHz,5 GHz');
  assert.equal(await page.locator('.zc-radio .zc-state-up').count(), 2);
  assert.match(await page.locator('.zc-disk .zc-gauge').innerText(), /53\.1%/);
  assert.match(await page.locator('.zc-disk .zc-gauge').innerText(), /29\.0 MiB free \/ 64\.0 MiB/);
  assert.match(await page.locator('.zc-identity').innerText(), /6\.18\.60/);
  assert.match(await page.locator('.zc-interface').filter({hasText:'br-lan'}).innerText(), /192\.0\.2\.1/);
  assert.match(await page.locator('.zc-traffic-values').innerText(), /82\.4 Mbps/);
  assert.equal(await page.getByRole('link', { name: 'Denied' }).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Traffic control', exact: true }).count(), 1);
  await page.clock.runFor(300000);
  await page.evaluate(() => dashboard.scheduler.refresh());
  assert.equal(await page.evaluate(() => dashboard.history.length), 60, 'graph history is not bounded');
  assert.ok(await page.evaluate(() => dashboard.cpuBusy > 0 && dashboard.cpuBusy < 100), 'CPU time sampling failed');
  assert.equal((await page.locator('.zc-cpu').boundingBox()).height,pendingCPU.height,'CPU section resized when its first sample arrived');
  assert.equal((await page.locator('.zc-memory').boundingBox()).height,pendingRAM.height,'RAM section resized after polling');
  assert.ok(await page.evaluate(() => dashboard.cpuHistory.length <= 60 && dashboard.ramHistory.length <= 60), 'resource histories are not bounded');
  assert.equal(await page.locator('.zc-sparkline').count(), 2);
  const historyBefore = await page.evaluate(() => [dashboard.cpuHistory.length,dashboard.ramHistory.length]);
  await page.evaluate(() => {dashboard.draw();dashboard.draw();});
  assert.deepEqual(await page.evaluate(() => [dashboard.cpuHistory.length,dashboard.ramHistory.length]),historyBefore,'redrawing duplicates resource samples');
  const oncePaths=['/proc/cpuinfo','/sys/devices/system/cpu/present','/sys/devices/system/cpu/cpufreq/policy0/cpuinfo_max_freq'];
  for(const target of oncePaths) assert.equal(await page.evaluate(target=>fixture.calls.filter(c=>c.key==='file.read'&&c.args[0]===target).length,target),1,'processor data was polled repeatedly');
  const tabGeometry = await page.getByRole('link', { name: 'Dashboard', exact: true }).evaluate(e => ({ link: e.getBoundingClientRect().height, row: e.parentElement.getBoundingClientRect().height }));
  assert.ok(tabGeometry.row >= tabGeometry.link, 'menu link is vertically clipped');
  for (const mode of ['light','dark','luxury']) {
   await page.locator(`[data-zcop-palette="${mode}"]`).click();
   await page.screenshot({ path: path.join(output, 'live-fixture-' + mode + '.png'), fullPage: true });
  }
  const sectionStyle = await page.locator('.zc-section').evaluateAll(sections => sections.every(section => {
   const css = getComputedStyle(section);
   return css.borderRadius === '0px' && css.borderLeftWidth === '0px' && css.borderRightWidth === '0px';
  }));
  assert.ok(sectionStyle, 'overview sections reverted to boxed cards');
  const devicePane = await page.locator('.zc-pane-device').boundingBox();
  const networkPane = await page.locator('.zc-pane-network').boundingBox();
  assert.ok(networkPane.width > devicePane.width * 1.15, 'panes lost content-based widths');
  assert.ok(Math.abs(networkPane.x - devicePane.x - devicePane.width) < 1, 'panes have a card-style gutter');
  await page.evaluate(() => { L.env.dispatchpath = ['admin','network','plugin','detail']; document.querySelector('#topmenu').replaceChildren(); document.querySelector('#tabmenu').replaceChildren(); menu.render(tree); });
  assert.equal(await page.getByRole('link', { name: 'Third-party app', exact: true }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'Deep settings', exact: true }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'QoS', exact: true }).count(), 0, 'QoS duplicated inside Network');
  await page.evaluate(() => { L.env.dispatchpath = ['admin','network','cr881x_yt921x_qos']; document.querySelector('#topmenu').replaceChildren(); document.querySelector('#tabmenu').replaceChildren(); menu.render(tree); });
  assert.equal(await page.locator('.zcop-navitem.active').innerText(), '◇\nTraffic control');
  assert.match(await page.getByRole('link', { name: 'QoS', exact: true }).getAttribute('href'), /admin\/network\/cr881x_yt921x_qos$/);
  await page.evaluate(() => { L.env.dispatchpath = ['admin','status','zcop_dashboard']; document.querySelector('#topmenu').replaceChildren(); document.querySelector('#tabmenu').replaceChildren(); menu.render(tree); });
  await page.evaluate(() => {tree.children.admin.children.status.children.zcop_dashboard.satisfied=false;document.querySelector('#topmenu').replaceChildren();document.querySelector('#tabmenu').replaceChildren();menu.render(tree);});
  assert.equal(await page.locator('#tabmenu').getByRole('link',{name:'Dashboard',exact:true}).count(),0,'denied dashboard exposed');
  assert.equal(await page.locator('#tabmenu').getByRole('link',{name:'System details',exact:true}).count(),1,'original permitted menu fallback lost');
  await page.evaluate(() => {tree.children.admin.children.status.children.zcop_dashboard.satisfied=true;document.querySelector('#topmenu').replaceChildren();document.querySelector('#tabmenu').replaceChildren();menu.render(tree);});
  assert.deepEqual(await page.locator('#tabmenu a').allTextContents(),['Dashboard']);
  await page.evaluate(()=>renderMenu(['admin','status','logs','dmesg']));
  assert.equal(await page.locator('.zcop-navitem.active').getAttribute('href'),'/cgi-bin/luci/admin/system');
  assert.equal(await page.locator('#tabmenu a[aria-current="page"]').allTextContents().then(a=>a.join(',')),'Logs,Kernel Log');
  assert.match(await page.getByRole('link',{name:'Kernel Log',exact:true}).getAttribute('href'),/admin\/status\/logs\/dmesg$/);
  assert.equal(await page.getByRole('link',{name:'Realtime Graphs',exact:true}).count(),0);
  assert.equal(await page.getByRole('link',{name:'System details',exact:true}).count(),0);
  await page.evaluate(()=>renderMenu(['admin','status','processes']));
  assert.match(await page.locator('.zcop-navitem.active').innerText(),/System$/);
  assert.equal(await page.locator('#tabmenu a[aria-current="page"]').innerText(),'Processes');
  for(const [name,title]of [['routesj','Routing table'],['nftables','Firewall status'],['channel_analysis','Channel analysis'],['wireguard','WireGuard status']]){
   await page.evaluate(name=>renderMenu(['admin','status',name]),name);
   assert.match(await page.locator('.zcop-navitem.active').innerText(),/Network$/);
   assert.deepEqual(await page.locator('#tabmenu a[aria-current="page"]').allTextContents(),['Diagnostics',title]);
   assert.equal(await page.getByRole('link',{name:title,exact:true}).getAttribute('href'),'/cgi-bin/luci/admin/status/'+name);
  }
  await page.evaluate(()=>renderMenu(['admin','network','diagnostics']));
  assert.deepEqual(await page.locator('#tabmenu a[aria-current="page"]').allTextContents(),['Diagnostics','Connectivity']);
  assert.equal(await page.getByRole('link',{name:'Connectivity',exact:true}).getAttribute('href'),'/cgi-bin/luci/admin/network/diagnostics');
  await page.evaluate(()=>renderMenu(['admin','status','custom_monitor','details']));
  assert.match(await page.locator('.zcop-navitem.active').innerText(),/System$/);
  assert.deepEqual(await page.locator('#tabmenu a[aria-current="page"]').allTextContents(),['Diagnostics','App monitor','Monitor details']);
  assert.equal(await page.getByRole('link',{name:'Monitor details',exact:true}).getAttribute('href'),'/cgi-bin/luci/admin/status/custom_monitor/details');
  await page.evaluate(()=>renderMenu(['admin','status','custom_alias']));
  assert.match(await page.locator('.zcop-navitem.active').innerText(),/System$/);
  assert.equal(await page.getByRole('link',{name:'Deep settings',exact:true}).getAttribute('href'),'/cgi-bin/luci/admin/network/plugin/detail','alias subpage invented a backend route');
  await page.evaluate(()=>{tree.children.admin.children.status.children.nftables.satisfied=false;renderMenu(['admin','network','diagnostics']);});
  assert.equal(await page.getByRole('link',{name:'Firewall status',exact:true}).count(),0,'denied status entry reappeared');
  await page.evaluate(()=>{tree.children.admin.children.status.children.nftables.satisfied=true;window.savedMenu=tree;tree=JSON.parse(JSON.stringify(tree));delete tree.children.admin.children.system;delete tree.children.admin.children.network;renderMenu(['admin','status','logs','syslog']);});
  assert.equal(await page.getByRole('link',{name:'System',exact:true}).getAttribute('href'),'/cgi-bin/luci/admin/status/logs');
  assert.equal(await page.getByRole('link',{name:'Network',exact:true}).getAttribute('href'),'/cgi-bin/luci/admin/status/routesj');
  assert.equal(await page.getByRole('link',{name:'Connectivity',exact:true}).count(),0,'configuration-only entry invented for read-only user');
  await page.evaluate(()=>{tree=savedMenu;renderMenu(['admin','status','zcop_dashboard']);});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>renderMenu(['admin','status','logs','dmesg']));
  assert.ok(await page.locator('#tabmenu a[aria-current="page"]').evaluateAll(links=>links.every(link=>{const a=link.getBoundingClientRect(),b=link.closest('ul').getBoundingClientRect();return a.right<=b.right+1&&a.left>=b.left-1;})),'relocated selected tab is outside mobile menu');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1440,height:940});
  await page.evaluate(()=>renderMenu(['admin','status','zcop_dashboard']));
  assert.equal(await page.evaluate(()=>JSON.stringify(tree,(key,value)=>key==='name'?undefined:value)),await page.evaluate(()=>originalMenuJSON),'menu presentation mutated registered ACL data');
  assert.deepEqual(await page.locator('#tabmenu a').allTextContents(),['Dashboard']);
  const beforeHidden = await page.evaluate(() => { fixture.hidden = true; document.dispatchEvent(new Event('visibilitychange')); return fixture.calls.length; });
  await page.clock.runFor(60000);
  assert.equal(await page.evaluate(() => fixture.calls.length), beforeHidden, 'hidden page polled');
  await page.evaluate(() => { fixture.hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(10);
  await page.evaluate(() => dashboard.scheduler.refresh());
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const beforePause = await page.evaluate(() => fixture.calls.length);
  assert.equal((await page.locator('.zc-cpu').boundingBox()).height,pendingCPU.height,'CPU section resized when paused');
  await page.clock.runFor(60000);
  assert.equal(await page.evaluate(() => fixture.calls.length), beforePause, 'paused page polled');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(10);
  await page.evaluate(() => dashboard.scheduler.refresh());
  await page.getByRole('combobox', { name: 'Refresh interval' }).selectOption('0');
  await page.evaluate(async () => { fixture.optional = true; dashboard.due = {}; await dashboard.scheduler.refresh(); });
  assert.match(await page.locator('.zc-acceleration').innerText(), /Unavailable/);
  await page.evaluate(async () => { fixture.fail = true; dashboard.due = {}; await dashboard.scheduler.refresh(); });
  assert.match(await page.locator('.zc-refresh-status').innerText(), /unavailable or stale/);
  assert.equal(await page.locator('.zc-traffic-empty').innerText(), 'WAN status unavailable');
  assert.equal(await page.locator('.zc-traffic-values strong').allTextContents().then(v=>v.join(',')), '—,—');
  assert.match(await page.locator('.zc-cpu').innerText(), /CPU data unavailable/);
  assert.equal((await page.locator('.zc-cpu').boundingBox()).height,pendingCPU.height,'CPU section collapsed on failure');
  assert.equal((await page.locator('.zc-memory').boundingBox()).height,pendingRAM.height,'RAM section collapsed on failure');
  await page.evaluate(async () => { fixture.fail = false; dashboard.due = {}; await dashboard.scheduler.refresh(); });
  // Unsupported values must stay unknown; known empty lists and zero flows
  // must remain valid zeros. Physical link and Internet reachability differ.
  await page.evaluate(async () => {
   fixture.optional = false;
   fixture.overrides = {
    'network.interface.dump': {interface:[{interface:'wan',proto:'dhcp'}]},
    'luci-rpc.getNetworkDevices': {wan:{},lan1:{link:{carrier:false}}},
    'luci-rpc.getWirelessDevices': {radio0:{interfaces:[]},radio1:{up:false,disabled:true,config:{band:'5g'}}},
    'luci-rpc.getDHCPLeases': {}
   };
   dashboard.due = {}; await dashboard.scheduler.refresh();
  });
  assert.equal(await page.locator('.zc-connection .zc-state').innerText(), 'Unavailable');
  assert.match(await page.locator('.zc-port').filter({hasText:'WAN'}).innerText(), /Unavailable/);
  assert.match(await page.locator('.zc-port').filter({hasText:'LAN1'}).innerText(), /No link/);
  assert.match(await page.locator('.zc-radio').first().innerText(), /Unavailable/);
  assert.match(await page.locator('.zc-radio').last().innerText(), /Disabled/);
  assert.equal(await page.locator('.zc-network-footer .zc-datum strong').allTextContents().then(v=>v.join(',')), '—,—');
  await page.evaluate(async () => {
   fixture.overrides['system.info'] = {memory:{total:0,available:1}};
   fixture.overrides['luci.getMountPoints'] = {result:[]};
   dashboard.due={}; await dashboard.scheduler.refresh();
  });
  assert.match(await page.locator('.zc-memory').innerText(), /Memory data unavailable/);
  assert.match(await page.locator('.zc-disk').innerText(), /Storage data unavailable/);
  await page.evaluate(async () => {
   fixture.overrides['luci-rpc.getDHCPLeases'] = {dhcp_leases:[],dhcp6_leases:[]};
   fixture.overrides['file.read'] = {data:'0\n'};
   dashboard.due = {}; await dashboard.scheduler.refresh();
  });
  assert.equal(await page.locator('.zc-network-footer .zc-datum strong').allTextContents().then(v=>v.join(',')), '0,0');
  assert.equal(await page.locator('.zc-acceleration .zc-datum strong').allTextContents().then(v=>v.join(',')), '0,0');
  await page.evaluate(async () => {
   fixture.overrides = {
    'network.interface.dump': {interface:[{interface:'wan',up:false,proto:'dhcp'}]},
    'luci-rpc.getWirelessDevices': {radio0:{up:true,config:{band:'5g'},interfaces:[]}}
   };
   dashboard.due={}; await dashboard.scheduler.refresh();
  });
  assert.equal(await page.locator('.zc-traffic-empty').innerText(), 'WAN interface is down');
  assert.equal(await page.locator('.zc-chart').count(), 0, 'down WAN shows an active chart');
  assert.equal(await page.locator('.zc-radio .zc-state').innerText(), 'No networks');
  assert.equal(await page.locator('.zc-radio .zc-state-up').count(), 0, 'empty radio implies a live network');
  await page.evaluate(async () => {
   fixture.overrides['network.interface.dump'] = {interface:[]};
   dashboard.due={}; await dashboard.scheduler.refresh();
  });
  assert.equal(await page.locator('.zc-traffic-empty').innerText(), 'No WAN configured');
  await page.evaluate(async () => {
   fixture.overrides = {'network.device.status':{statistics:{rx_bytes:100,tx_bytes:100}}};
   dashboard.due={}; await dashboard.scheduler.refresh();
  });
  await page.clock.runFor(5000);
  await page.evaluate(async () => {dashboard.due={}; await dashboard.scheduler.refresh();});
  await page.clock.runFor(5000);
  await page.evaluate(async () => {dashboard.due={}; await dashboard.scheduler.refresh();});
  assert.equal(await page.locator('.zc-traffic-values strong').allTextContents().then(v=>v.join(',')), '0.0 Mbps,0.0 Mbps');
  assert.equal(await page.locator('.zc-chart').count(), 1, 'valid idle samples lost their chart');
  assert.equal(await page.locator('.zc-traffic-empty').count(), 0, 'valid idle zero mislabeled as missing');
  await page.evaluate(async () => {fixture.overrides={}; dashboard.due={}; await dashboard.scheduler.refresh();});
  await page.evaluate(async () => {
   fixture.overrides = {'network.interface.dump':{interface:[
    {interface:'wan',up:true,proto:'pppoe',l3_device:'pppoe-wan', 'ipv4-address':[{address:'192.0.2.2'}]},
    {interface:'wan_6',up:true,proto:'dhcpv6','ipv6-address':[{address:'2001:db8:1234:5678:9abc:def0:1234:5678'}]},
    {interface:'a-long-logical-interface-name',up:true,proto:'static',l3_device:'br-long-interface','ipv4-address':[{address:'198.51.100.42'}]}
   ]}};
   dashboard.due={}; await dashboard.scheduler.refresh();
  });
  assert.match(await page.locator('.zc-addresses').innerText(), /2001:db8:1234:5678:9abc:def0:1234:5678/);
  for (const [width,height] of [[1366,650],[1536,720],[1920,850],[1024,768],[768,1024],[390,844]]) {
   await page.setViewportSize({ width,height });
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'page overflow at ' + width);
   assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), false, 'document scrolls at ' + width);
   assert.equal(await page.locator('.zcop-content').evaluate(e=>e.scrollWidth>e.clientWidth+2), false, 'long dashboard values overflow at '+width);
   const notice=await page.locator('.zcop-password-notice').boundingBox();
   const command=await page.locator('.zcop-command').boundingBox();
   assert.ok(notice.x>=command.x && notice.x+notice.width<=command.x+command.width+1,'notice escaped fixed bar at '+width);
  }
  await page.evaluate(async () => {
   fixture.overrides = {'network.interface.dump':{interface:Array.from({length:16},(_,i)=>({
    interface:i===0?'lan':i===1?'wan':i===2?'vpn-office-long-name':i===3?'gre-tunnel':'vpn_'+i,
    up:i%3!==0,proto:i<2?'static':i===3?'gre':'wireguard',l3_device:i===0?'br-lan':i===1?'wan':'tunnel'+i,
    'ipv4-address':[{address:'192.0.2.'+(i+1)}],
    'ipv6-address':[{address:'2001:db8:1234:5678:9abc:def0:1234:'+i.toString(16)}]
   }))}};
   dashboard.due={};await dashboard.scheduler.refresh();
  });
  assert.equal(await page.locator('.zc-interface').count(),16,'logical interfaces were omitted');
  assert.match(await page.locator('.zc-interface-count').innerText(),/16 total · 10 up/);
  assert.equal(await page.locator('.zc-interfaces th').count(),5);
  assert.equal(await page.getByText('No current rate',{exact:true}).count(),0);
  assert.equal(await page.getByText('No WAN device',{exact:true}).count(),0);
  for(const width of [1536,1024,768,390]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.locator('.zcop-content').evaluate(e=>e.scrollWidth>e.clientWidth+2),false,'VPN list overflow at '+width);
   if(width===1536){
    const interfaces=await page.locator('.zc-interfaces-section').boundingBox(),device=await page.locator('.zc-pane-device').boundingBox();
    assert.ok(interfaces.width>device.width*1.9,'interfaces did not gain width');
    assert.ok((await page.locator('.zc-interface').first().boundingBox()).height<55,'wide rows are still vertically stacked');
   }
   await page.locator('.zc-interface').last().scrollIntoViewIfNeeded();
   assert.ok(await page.locator('.zc-interface').last().isVisible(),'last VPN interface unreachable');
  }
  await page.evaluate(async () => {fixture.overrides={};dashboard.due={};await dashboard.scheduler.refresh();});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.zcop-content').evaluate(e=>e.scrollTo(0,0));
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  assert.equal(await page.getByRole('button', { name: 'Toggle navigation' }).getAttribute('aria-expanded'), 'true');
  await page.getByRole('link', {name:'Services',exact:true}).focus();
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), false, 'open mobile menu scrolls document');
  const mobileCommand = await page.locator('.zcop-command').boundingBox();
  assert.ok(mobileCommand.y >= 0 && mobileCommand.y + mobileCommand.height < 844, 'mobile section menu clipped');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Toggle navigation' }).getAttribute('aria-expanded'), 'false');
  await page.screenshot({ path: path.join(output, 'live-fixture-mobile.png'), fullPage: true });
  // A long configuration form must scroll inside the frame while its menus
  // remain stationary, and keyboard focus must reach its last control.
  await page.evaluate(() => {
   const section = document.createElement('section'); section.id = 'long-form-fixture';
   section.innerHTML = '<div style="height:1600px">Long configuration form fixture</div><div class="cbi-page-actions"><button id="fixture-save">Save fixture</button></div>';
   document.querySelector('#view').append(section);
  });
  for (const [width,height] of [[1366,650],[1920,850],[390,844]]) {
   await page.setViewportSize({ width,height });
   await page.locator('.zcop-content').evaluate(e => { e.scrollTop = 0; });
   const before = await page.locator('.zcop-command').boundingBox();
   const sidebarBefore = width > 720 ? await page.locator('.zcop-sidebar').boundingBox() : null;
   await page.locator('#fixture-save').evaluate(e => e.blur());
   await page.locator('#fixture-save').focus();
   const after = await page.locator('.zcop-command').boundingBox();
   assert.equal(after.y, before.y, 'section menu moved at ' + width);
   assert.ok((await page.locator('.zcop-password-notice').boundingBox()).y<after.y+after.height,'notice moved with content');
   if (sidebarBefore) assert.equal((await page.locator('.zcop-sidebar').boundingBox()).y, sidebarBefore.y, 'sidebar moved');
   assert.ok(await page.locator('.zcop-content').evaluate(e => e.scrollTop > 0), 'frame did not scroll at ' + width);
   assert.equal(await page.evaluate(() => document.scrollingElement.scrollTop), 0, 'window scrolled');
   assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), false, 'long form escaped viewport');
   const button = await page.locator('#fixture-save').boundingBox();
   assert.ok(button.y >= after.y + after.height && button.y + button.height <= height, 'final action clipped');
  }
  await page.evaluate(() => document.querySelector('#long-form-fixture').remove());
  // Switching content and menu groups must not let intrinsic page widths
  // resize the shell. Wide third-party tables scroll in the content frame.
  await page.evaluate(() => {
   window.savedView = [...document.querySelector('#view').childNodes];
   document.querySelector('#view').replaceChildren();
  });
  for (const [width,height] of [[390,844],[768,1024],[1366,650],[1920,850]]) {
   await page.setViewportSize({width,height});
   const shell = await page.locator('.zcop-main').boundingBox();
   for (const variant of ['narrow','form','wide']) {
    await page.evaluate(variant => {
     L.env.dispatchpath = variant === 'narrow' ? ['admin','status','zcop_dashboard'] : ['admin','system','system'];
     document.querySelector('#topmenu').replaceChildren();
     document.querySelector('#tabmenu').replaceChildren();
     menu.render(tree);
     const view = document.querySelector('#view');
     if (variant === 'narrow') view.innerHTML = '<p style="max-width:180px">A short page.</p>';
     else if (variant === 'form') view.innerHTML = '<div class="cbi-map"><div class="cbi-value"><label class="cbi-value-title" for="fixture-notes">Notes</label><div class="cbi-value-field"><textarea id="fixture-notes" style="width:100%">A form with a fluid field</textarea></div></div></div>';
     else view.innerHTML = '<table class="table" style="min-width:2000px"><thead><tr><th>First column</th><th>Middle column</th><th>Final column</th></tr></thead><tbody><tr><td>192.0.2.1</td><td>Wide third-party table fixture</td><td><button id="fixture-table-action">Last column action</button></td></tr></tbody></table>';
     document.querySelector('.zcop-content').scrollTo(0,0);
    }, variant);
    assert.deepEqual(await page.locator('.zcop-main').boundingBox(), shell, `${variant} page resized shell at ${width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${variant} escaped viewport`);
    if (variant === 'form') {
     const field = await page.locator('#fixture-notes').boundingBox();
     const frame = await page.locator('.zcop-content').boundingBox();
     assert.ok(field.x >= frame.x && field.x + field.width <= frame.x + frame.width, 'form field escaped frame');
    }
    if (variant === 'wide') {
     const command = await page.locator('.zcop-command').boundingBox();
     await page.locator('#fixture-table-action').focus();
     assert.ok(await page.locator('.zcop-content').evaluate(e => e.scrollLeft > 0), 'wide table did not scroll inside frame');
     assert.deepEqual(await page.locator('.zcop-command').boundingBox(), command, 'horizontal scroll moved section menu');
     assert.deepEqual(await page.locator('.zcop-main').boundingBox(), shell, 'horizontal scroll resized frame');
     const action = await page.locator('#fixture-table-action').boundingBox();
     const frame = await page.locator('.zcop-content').boundingBox();
     assert.ok(action.x >= frame.x && action.x + action.width <= frame.x + frame.width, 'last table action unreachable');
     assert.equal(await page.evaluate(() => document.scrollingElement.scrollLeft), 0, 'document scrolled horizontally');
    }
   }
  }
  await page.evaluate(() => {
   document.querySelector('#view').replaceChildren(...savedView);
   L.env.dispatchpath = ['admin','status','zcop_dashboard'];
   document.querySelector('#topmenu').replaceChildren();
   document.querySelector('#tabmenu').replaceChildren();
   menu.render(tree);
  });
  await page.setViewportSize({width:1440,height:940});
  await page.locator('.zcop-content').evaluate(e => { e.scrollTo(0,0); });
  await page.screenshot({path:path.join(output,'fixed-frame-desktop.png')});
  assert.deepEqual(errors, []);
  console.log('PASS: actual modules, ACL/deep menus, metric units, hidden/paused/manual modes, unavailable data, 3 palettes and responsive layouts');
 } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
