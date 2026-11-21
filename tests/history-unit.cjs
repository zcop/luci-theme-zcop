/* SPDX-License-Identifier: Apache-2.0 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
class Base {}
Base.extend = properties => { class Module extends Base {} Object.assign(Module.prototype, properties); return Module; };
const Module = new Function('baseclass', fs.readFileSync(path.join(root, 'luci-app-zcop-dashboard/htdocs/luci-static/resources/zcop/metrics.js'), 'utf8'))(Base);
const metrics = new Module();
const sample = (time, used, rx, device = 'phy1-sta0') => ({ time, cpu: { total: time, idle: time - used },
 memory: { total: 1000, available: 700, free: 100, cached: 400, shared: 50 }, network: { [device]: { rx, tx: rx / 2 } } });
const reply = { now: 15000, samples: [sample(5000, 100, 0), sample(10000, 1100, 5000000), sample(15000, 1200, 6000000)] };
let result = metrics.recorded(reply, 'phy1-sta0');
assert.deepEqual(result.cpuHistory, [null, 20, 2]);
assert.deepEqual(result.ramHistory, [{used:55,cache:35}, {used:55,cache:35}, {used:55,cache:35}]);
assert.equal(result.cpuBusy, 2);
assert.equal(result.history[1].down, 8);
assert.equal(result.traffic.down, 1.6);
assert.equal(result.traffic.up, 0.8);
assert.equal(metrics.recorded({}, 'wan'), null);
assert.deepEqual(metrics.recorded({now:5000,samples:[{...sample(5000,100,0),memory:{total:1000,available:700}}]},'wan').ramHistory,[null],
 'old/missing breakdown data was fabricated as zero');
assert.equal(metrics.recorded({ ...reply, now: 14000 }, 'wan'), null);
assert.equal(metrics.recorded({ ...reply, now: 31000 }, 'wan'), null);
assert.equal(metrics.recorded(reply, 'wan').traffic, null);
result = metrics.recorded({ now: 40000, samples: [reply.samples[0], sample(40000, 1300, 9000000)] }, 'phy1-sta0');
assert.deepEqual(result.cpuHistory, [null, null]);
assert.equal(result.traffic, null);
result = metrics.recorded({ now: 20000, samples: [...reply.samples, sample(20000, 100, 10)] }, 'phy1-sta0');
assert.equal(result.traffic, null, 'counter reset created a traffic spike');
result = metrics.recorded({ now: 5000, samples: [sample(5000, 100, 10)] }, 'phy1-sta0');
assert.equal(result.cpuBusy, null, 'new router boot reused an old CPU baseline');
result = metrics.recorded({ now: 400000, samples: Array.from({length: 80}, (_, i) => sample((i + 1) * 5000, i * 100, i * 1000)) }, 'phy1-sta0');
assert.equal(result.history.length, 60);
assert.equal(result.cpuHistory.length, 60);
console.log('PASS: recorded CPU/RAM/traffic, hidden-period peaks, stale data, counter resets, device identity, reboot and bounded history');

const collector = fs.readFileSync(path.join(root, 'luci-app-zcop-dashboard/root/usr/share/rpcd/ucode/luci.zcop_dashboard'), 'utf8')
 .replace(/^import .*;\n/gm, '');
const harness = `
let now = 0;
let tick = null;
let network = ' lo: 1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0\\n';
for (let i = 0; i < 70; i++)
 network += sprintf('dev%d: 100 1 0 0 0 0 0 0 200 1 0 0 0 0 0 0\\n', i);
function readfile(file) {
 if (file == '/proc/sys/kernel/random/boot_id') return 'fixture-boot\\n';
 if (file == '/proc/uptime') return sprintf('%d.00 0.00\\n', now);
 if (file == '/proc/stat') return sprintf('cpu  %d 0 0 %d 0 0 0 0 999 999\\n', now * 10, now * 90);
 if (file == '/proc/meminfo') return 'MemTotal: 1000 kB\\nMemAvailable: 700 kB\\nMemFree: 100 kB\\nCached: 400 kB\\nShmem: 50 kB\\n';
 if (file == '/proc/net/dev') return network;
 return null;
}
function timer(delay, callback) {
 tick = callback;
 return { set: function(value) { if (value != 5000) die('wrong cadence'); } };
}
function check(value, message) { if (!value) die(message); }
const api = (function() {
${collector}
})();
// No API requests occur while 65 samples are collected.
for (let i = 0; i < 65; i++) { now += 5; tick(); }
const result = api['luci.zcop_dashboard'].history.call();
check(result.boot_id == 'fixture-boot', 'boot identity');
check(length(result.samples) == 60, 'unbounded RAM history');
check(result.samples[0].time == 30000, 'oldest sample not evicted');
check(result.samples[59].time == 325000, 'latest sample missing');
check(result.samples[59].cpu.total == 32500, 'guest CPU time counted twice');
check(result.samples[59].memory.available == 716800, 'memory unit conversion');
check(result.samples[59].memory.free == 102400, 'free memory unit conversion');
check(result.samples[59].memory.cached == 409600, 'cache unit conversion');
check(result.samples[59].memory.shared == 51200, 'shared memory unit conversion');
check(length(keys(result.samples[59].network)) == 64, 'unbounded interfaces');
check(result.samples[59].network.dev0.tx == 200, 'network byte fields');
print('PASS: actual rpcd collector samples without browser requests and bounds history and interfaces\\n');
`;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zcop-history-'));
try {
 const file = path.join(directory, 'collector.uc');
 fs.writeFileSync(file, harness);
 process.stdout.write(execFileSync(process.env.UCODE || 'ucode', [file], {encoding: 'utf8'}));
} finally { fs.rmSync(directory, {recursive: true, force: true}); }
