/* SPDX-License-Identifier: Apache-2.0 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
class Base {}
Base.extend = properties => { class Module extends Base {} Object.assign(Module.prototype, properties); return Module; };
const load = name => {
 const Module = new Function('baseclass', fs.readFileSync(path.join(root, 'luci-app-zcop-dashboard/htdocs/luci-static/resources/zcop', name + '.js'), 'utf8'))(Base);
 assert.ok(typeof Module === 'function' && Module.prototype instanceof Base, 'LuCI requires a baseclass subclass export: ' + name);
 return new Module();
};
const metrics = load('metrics'), Scheduler = load('scheduler');

(async () => {
 const cpuInfo = 'processor : 0\nmodel name : ARMv8 Processor rev 4 (v8l)\nCPU architecture: 8\nCPU revision: 4\n';
 assert.deepEqual(metrics.processor(cpuInfo, '0-1\n', '1200000\n', 'fallback'), {architecture:'ARMv8',cores:2,maxKHz:1200000});
 assert.equal(metrics.processor(cpuInfo, '0-1,1,4', '1200000').cores,3);
 assert.equal(metrics.processor(cpuInfo, 'invalid', '').cores,1);
 assert.deepEqual(metrics.processor('', '', '', ''),{architecture:null,cores:null,maxKHz:null});
 assert.equal(metrics.processor(cpuInfo,'0-1','0').maxKHz,null);
 assert.equal(metrics.processor(cpuInfo,'0-1','NaN').maxKHz,null);
 assert.equal(metrics.processor(cpuInfo,'0-1','9999999999999999999999').maxKHz,null);
 assert.equal(metrics.processor(cpuInfo.replace('ARMv8 Processor','ARMv8.2 Processor'),'0-1','1200000').architecture,'ARMv8.2');
 assert.equal(metrics.processor(cpuInfo,'0-999999999','1200000').cores,1);
 assert.deepEqual(metrics.cpu('cpu  100 2 30 400 5 6 7 0 99 10\ncpu0 1'), { total: 550, idle: 405 });
 assert.equal(metrics.cpu('missing'), null);
 assert.equal(metrics.cpuPercent({ total: 100, idle: 50 }, { total: 200, idle: 140 }), 10);
 assert.equal(metrics.cpuPercent({ total: 200, idle: 50 }, { total: 100, idle: 10 }), null);
 const before = { device: 'wan', time: 1000, rx: 0, tx: 0 };
 assert.deepEqual(metrics.rate(before, { device: 'wan', time: 6000, rx: 62500000, tx: 6250000 }), { time: 6000, down: 100, up: 10 });
 assert.equal(metrics.rate(before, { ...before, device: 'pppoe-wan', time: 6000 }), null);
 assert.equal(metrics.rate({ ...before, rx: 100 }, { ...before, time: 6000, rx: 5 }), null);
 assert.equal(metrics.rate(before, { ...before, time: 61000 }), null);
 assert.equal(metrics.rate(before, { ...before, time: 6000, rx: undefined }), null);
 assert.equal(metrics.count('0\n'), 0); assert.equal(metrics.count(''), null); assert.equal(metrics.count('error'), null);
 assert.equal(metrics.append(Array(60).fill(null), { down: 1 }).length, 60);
 assert.equal(metrics.wan([{ interface: 'lan' }, { interface: 'wan', l3_device: 'pppoe-wan' }]).l3_device, 'pppoe-wan');
 assert.equal(metrics.wan([{ interface: 'uplink', route: [{ target: '::' }] }]).interface, 'uplink');
 const ports = Object.fromEntries(['wan','lan1','lan2','lan3'].map(name => [name, {}]));
 const mode = {ok:true,wan:'wan',wan2:'<unset>',br_lan_ports:'<unset>'};
 const devices = {...ports,'br-lan':{ports:['lan1','lan2','lan3']}};
 assert.deepEqual(metrics.portRoles(mode,devices),{
  wan:{roles:['wan1'],state:'assigned'},lan1:{roles:['lan'],state:'assigned'},
  lan2:{roles:['lan'],state:'assigned'},lan3:{roles:['lan'],state:'assigned'}
 });
 assert.deepEqual(metrics.portRoles({...mode,wan:'<unset>'},{...devices,'br-lan':{ports:Object.keys(ports)}}).wan,{roles:['lan'],state:'assigned'});
 const dual = metrics.portRoles({...mode,wan:'lan1',wan2:'lan2'},{...devices,'br-lan':{ports:['wan','lan3']}});
 assert.deepEqual(dual.lan1,{roles:['wan1'],state:'assigned'});
 assert.deepEqual(dual.lan2,{roles:['wan2'],state:'assigned'});
 assert.deepEqual(dual.wan,{roles:['lan'],state:'assigned'});
 assert.equal(metrics.portRoles({...mode,wan:'lan1'},devices).lan1.state,'conflict','transitional/direct conflict was hidden');
 assert.deepEqual(metrics.portRoles({...mode,wan:'lan1.35'},devices).lan1,{roles:['lan','wan1'],state:'shared'});
 assert.deepEqual(metrics.portRoles({...mode,wan:'lan1.35.4094'},devices).lan1.roles,['lan','wan1']);
 for(const value of ['lan1.0','lan1.4095','lan1.35evil','lan11.35','pppoe-wan','br-wan'])
  assert.equal(metrics.portRoles({...mode,wan:value},devices).wan.state,'unknown','guessed physical mapping: '+value);
 assert.equal(metrics.portRoles({...mode,wan:'lan1.35',wan2:'lan1.36'},devices).lan1.state,'shared');
 assert.equal(metrics.portRoles({...mode,wan:'wan',wan2:'wan'},devices).wan.state,'conflict');
 assert.equal(metrics.portRoles(mode,{...devices,'br-lan':{ports:[]}}).lan1.state,'other');
 assert.equal(metrics.portRoles({...mode,br_lan_ports:'wan lan2 lan3'},{...devices,'br-lan':{ports:[]}}).lan1.state,'other','configured ports overrode the current bridge');
 assert.equal(metrics.portRoles({...mode,br_lan_ports:'lan1 lan2 lan3'},ports).lan1.state,'assigned');
 assert.equal(metrics.portRoles(mode,ports).lan1.state,'unknown','unset helper output was treated as an empty LAN');
 for(const status of [null,{}, {...mode,ok:false}, {ok:true}])
  assert.ok(Object.values(metrics.portRoles(status,devices)).every(p=>p.state==='unknown'&&p.roles.length===0));
 assert.deepEqual(metrics.portRoles(mode,null),{});
 assert.deepEqual(metrics.portLabels(metrics.portRoles(mode,devices)),{lan1:'LAN1',lan2:'LAN2',lan3:'LAN3',wan:'WAN1'});
 assert.deepEqual(metrics.portLabels(dual),{lan1:'WAN1',lan2:'WAN2',lan3:'LAN3',wan:'LAN4'});
 const allLan=metrics.portRoles({...mode,wan:'<unset>'},{...devices,'br-lan':{ports:Object.keys(ports)}});
 assert.deepEqual(metrics.portLabels(allLan),{lan1:'LAN1',lan2:'LAN2',lan3:'LAN3',wan:'LAN4'});
 assert.deepEqual(metrics.portLabels(Object.fromEntries(Object.entries(allLan).reverse())),metrics.portLabels(allLan),'RPC ordering changed logical port labels');
 assert.equal(metrics.portLabels(metrics.portRoles({...mode,wan:'lan1.35'},devices)).lan1,'LAN1 / WAN1');
 assert.deepEqual(metrics.portLabels(null),{});
 const acl=JSON.parse(fs.readFileSync(path.join(root,'luci-app-zcop-dashboard/root/usr/share/rpcd/acl.d/luci-app-zcop-dashboard.json')));
 assert.deepEqual(acl['luci-app-zcop-dashboard'].read.ubus['luci.cr881x_wan_mode'],['status']);
 assert.equal(acl['luci-app-zcop-dashboard'].write,undefined,'Dashboard gained role-change permission');
 const timers = new Map(); let next = 0, resets = 0, calls = 0, release;
 const environment = { setTimeout(fn, delay) { const id = ++next; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); } };
 const scheduler = Scheduler.create(() => { calls++; return new Promise(r => release = r); }, () => resets++, environment);
 scheduler.plan(0); assert.equal(timers.size, 1);
 const first = scheduler.refresh();
 await scheduler.refresh(); assert.equal(calls, 1, 'collector overlap');
 scheduler.visibility(true); release(); await first; assert.equal(timers.size, 0, 'hidden polling');
 scheduler.visibility(false); assert.equal(timers.size, 1);
 scheduler.pause(true); assert.equal(timers.size, 0);
 await scheduler.refresh(); assert.equal(calls, 1, 'paused polling');
 scheduler.pause(false); scheduler.setInterval(0); assert.equal(timers.size, 0, 'manual polling');
 const manual = scheduler.refresh(); release(); await manual; assert.equal(calls, 2); assert.equal(timers.size, 0);
 scheduler.setInterval(5000); scheduler.collect = () => Promise.reject(new Error('fixture error'));
 await scheduler.refresh(); assert.equal([...timers.values()][0].delay, 10000, 'failure backoff');
 scheduler.stop(); assert.equal(timers.size, 0); assert.ok(resets >= 5);
 console.log('PASS: port roles, VLAN sharing/conflicts/unknown, read-only ACL, CPU/rates, NSS missing vs zero, bounded history and serial/hidden/manual polling');
})().catch(error => { console.error(error); process.exitCode = 1; });
