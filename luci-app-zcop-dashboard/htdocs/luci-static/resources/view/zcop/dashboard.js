'use strict';
'require view';
'require rpc';
'require zcop.metrics as metrics';
'require zcop.scheduler as Scheduler';

/* SPDX-License-Identifier: Apache-2.0. No shell execution or background service. */
const info = rpc.declare({ object: 'system', method: 'info', expect: { '': {} }, reject: true });
const board = rpc.declare({ object: 'system', method: 'board', expect: { '': {} }, reject: true });
const interfaces = rpc.declare({ object: 'network.interface', method: 'dump', expect: { interface: [] }, reject: true });
const devices = rpc.declare({ object: 'luci-rpc', method: 'getNetworkDevices', expect: { '': {} }, reject: true });
const device = rpc.declare({ object: 'network.device', method: 'status', params: ['name'], expect: { '': {} }, reject: true });
const wireless = rpc.declare({ object: 'luci-rpc', method: 'getWirelessDevices', expect: { '': {} }, reject: true });
const leases = rpc.declare({ object: 'luci-rpc', method: 'getDHCPLeases', expect: { '': {} }, reject: true });
const mounts = rpc.declare({ object: 'luci', method: 'getMountPoints', expect: { result: [] }, reject: true });
const read = rpc.declare({ object: 'file', method: 'read', params: ['path'], expect: { data: '' }, reject: true });

const number = n => Number.isFinite(n) ? n.toFixed(1) : '—';
const mib = n => Number.isFinite(n) ? number(n / 1048576) + ' MiB' : '—';
const rate = n => Number.isFinite(n) ? number(n) + ' Mbps' : '—';
function pair(label, value) { return E('div', { 'class': 'zc-datum' }, [E('span', {}, label), E('strong', {}, value)]); }
function section(title, content, kind) { return E('section', { 'class': 'zc-section zc-' + kind }, [E('h3', {}, title), ...content]); }
function status(text, tone) { return E('span', { 'class': 'zc-state zc-state-' + (tone || 'neutral') }, text); }
function gauge(label, value, percent, detail) {
 return E('div', { 'class': 'zc-gauge' }, [pair(label, value),
  E('div', { 'class': 'zc-gauge-track', 'aria-hidden': 'true' }, Number.isFinite(percent)
   ? [E('span', { style: 'width:' + Math.max(0, Math.min(100, percent)) + '%' })] : []),
  detail ? E('p', { 'class': 'zc-note' }, detail) : null]);
}
function uptime(seconds) {
 if (!Number.isFinite(seconds) || seconds < 0) return '—';
 const days = Math.floor(seconds / 86400), hours = Math.floor(seconds / 3600) % 24;
 return days ? days + ' ' + _('d') + ' ' + hours + ' ' + _('h')
  : hours + ' ' + _('h') + ' ' + Math.floor(seconds / 60) % 60 + ' ' + _('min');
}

return view.extend({
 load() { return L.resolveDefault(board(), {}); },
 render(identity) {
  if (!document.querySelector('#zcop-dashboard-style'))
   document.head.append(E('link', { id: 'zcop-dashboard-style', rel: 'stylesheet', href: L.resource('zcop/dashboard.css') }));
  this.identity = identity;
  this.state = {};
  this.due = {};
  this.latestDevice = null;
  this.history = [];
  this.cpuHistory = [];
  this.ramHistory = [];
  this.generation = 0;
  this.failures = {};
  this.body = E('div', { 'class': 'zc-dashboard-grid' });
  this.status = E('span', { 'class': 'zc-refresh-status', 'role': 'status' }, _('Collecting initial snapshot…'));
  this.scheduler = Scheduler.create(() => this.collect(), () => {
   this.generation++;
   this.cpuBaseline = this.wanBaseline = null;
   this.cpuHistory = metrics.append(this.cpuHistory, null);
   this.ramHistory = metrics.append(this.ramHistory, null);
   this.due = {};
  });
  this.scheduler.hidden = document.hidden;
  const pause = E('button', { 'type': 'button', 'class': 'btn', 'aria-pressed': 'false', 'click': () => {
   const paused = !this.scheduler.paused;
   this.scheduler.pause(paused);
   pause.setAttribute('aria-pressed', String(paused));
   pause.textContent = paused ? _('Resume') : _('Pause');
   this.status.textContent = paused ? _('Paused') : _('Refreshing…');
  } }, _('Pause'));
  const cadence = E('select', { 'aria-label': _('Refresh interval'), 'change': event => {
   this.scheduler.setInterval(Number(event.target.value));
  } }, [E('option', { value: '5000' }, _('5 seconds')), E('option', { value: '10000' }, _('10 seconds')), E('option', { value: '0' }, _('Manual'))]);
  const root = E('div', { 'class': 'zc-dashboard' }, [
   E('h2', { 'class': 'zcop-sr-only' }, _('Dashboard')),
   E('div', { 'class': 'zc-dashboard-meta' }, [
    E('div', { 'class': 'zc-dashboard-title' }, [E('h3', {}, _('Overview'))]),
    E('div', { 'class': 'zc-dashboard-controls' }, [this.status, cadence,
     E('button', { 'type': 'button', 'class': 'btn', 'click': () => this.scheduler.refresh() }, _('Refresh')), pause])]),
   this.body
  ]);
  this.onVisibility = () => this.scheduler.visibility(document.hidden);
  document.addEventListener('visibilitychange', this.onVisibility);
  window.addEventListener('pagehide', () => { this.scheduler.stop(); document.removeEventListener('visibilitychange', this.onVisibility); }, { once: true });
  this.scheduler.plan(0);
  return root;
 },

 async collect() {
  const now = Date.now(), jobs = [], generation = this.generation;
  let required = 0, successful = 0;
  const queue = (name, period, fn) => {
   if (now < (this.due[name] || 0)) return;
   this.due[name] = now + period;
   if (!name.startsWith('nss')) required++;
   jobs.push(Promise.resolve().then(fn).then(value => {
    if (generation !== this.generation) return;
    this.state[name] = { value, time: Date.now() }; delete this.failures[name];
    if (!name.startsWith('nss')) successful++;
   }).catch(() => { if (generation === this.generation) this.failures[name] = true; }));
  };
  queue('system', 15000, info);
  queue('cpu', 15000, () => read('/proc/stat'));
  queue('interfaces', 15000, interfaces);
  queue('devices', 15000, devices);
  queue('wireless', 30000, wireless);
  queue('leases', 30000, leases);
  queue('mounts', 60000, mounts);
  // Optional NSS scalar counters. Missing debugfs or a different NSS provider
  // produces unavailable status, never a fabricated zero or enabled badge.
  queue('nss4', 30000, () => read('/sys/kernel/debug/ecm/ecm_nss_ipv4/accelerated_count'));
  queue('nss6', 30000, () => read('/sys/kernel/debug/ecm/ecm_nss_ipv6/accelerated_count'));
  const wan = metrics.wan(this.state.interfaces?.value || []);
  if (wan?.up && wan.l3_device) queue('wan', this.scheduler.interval || 5000, () => device(wan.l3_device).then(value => ({ device: wan.l3_device, status: value })));
  await Promise.all(jobs);
  if (generation !== this.generation || this.scheduler.stopped) return;
  if (!jobs.length) return;
  this.draw();
  const failed = Object.keys(this.failures).filter(n => !n.startsWith('nss'));
  this.status.textContent = failed.length ? _('Some data unavailable or stale') : _('Updated') + ' ' + new Date().toLocaleTimeString();
  if (required && !successful) throw new Error('Snapshot unavailable');
 },

 draw() {
  const state = this.state;
  const current = key => !this.failures[key] ? state[key]?.value : null;
  const wan = metrics.wan(current('interfaces') || []);
  const cpu = current('cpu');
  if (!cpu) this.cpuBusy = null;
  if (state.cpu?.time !== this.cpuTime) {
   const sample = metrics.cpu(cpu);
   this.cpuBusy = metrics.cpuPercent(this.cpuBaseline, sample);
   this.cpuHistory = metrics.append(this.cpuHistory, this.cpuBusy);
   this.cpuBaseline = sample; this.cpuTime = state.cpu?.time;
  }
  const memory = current('system')?.memory || {};
  const wanSample = current('wan');
  if (this.latestDevice !== wan?.l3_device) {
   this.history = []; this.wanBaseline = null; this.traffic = null;
   this.latestDevice = wan?.l3_device;
  }
  if (wan && wan.up && wanSample?.device === wan.l3_device && state.wan.time !== this.wanTime) {
   const stats = wanSample.status.statistics || wanSample.status.stats || {};
   const next = { device: wan.l3_device, rx: stats.rx_bytes, tx: stats.tx_bytes, time: state.wan.time };
   this.traffic = metrics.rate(this.wanBaseline, next);
   this.history = metrics.append(this.history, this.traffic);
   this.wanBaseline = next; this.wanTime = state.wan.time;
  } else if (!wan?.up || !wanSample || wanSample.device !== wan.l3_device) { this.traffic = null; this.wanBaseline = null; }
  const peak = Math.max(1, ...this.history.filter(Boolean).flatMap(sample => [sample.down, sample.up]));
  const trafficMessage = this.failures.interfaces ? _('WAN status unavailable')
   : !wan ? _('No WAN configured')
   : wan.up === false ? _('WAN interface is down')
   : wan.up !== true ? _('WAN status unavailable')
   : !wan.l3_device ? _('WAN device unavailable')
   : this.failures.wan ? _('Traffic counters unavailable')
   : !this.traffic ? _('Waiting for traffic samples') : null;
  const identity = this.identity || {}, release = identity.release || {};
  const cores = (cpu || '').match(/^cpu[0-9]+\s/gm)?.length;
  const deviceInfo = section(_('Device'), [
   E('div', { 'class': 'zc-device-model' }, identity.model || _('Unavailable')),
   E('div', { 'class': 'zc-specs' }, [
    pair(_('Hostname'), identity.hostname || '—'),
    pair(_('Processor'), [identity.system, cores ? cores + ' ' + _('cores') : ''].filter(Boolean).join(' · ') || '—'),
    pair(_('Platform'), release.target || '—'),
    pair(_('Firmware'), [release.distribution, release.version].filter(Boolean).join(' ') || '—'),
    pair(_('Build'), release.revision || '—'),
    pair(_('Kernel'), identity.kernel || '—'),
    pair(_('Uptime'), uptime(current('system')?.uptime))
   ])
  ], 'identity');
  const cpuPending = cpu && this.cpuBaseline && !Number.isFinite(this.cpuBusy);
  const memoryUsed = Number.isFinite(memory.total) && memory.total > 0 && Number.isFinite(memory.available)
   && memory.available >= 0 && memory.available <= memory.total ? memory.total - memory.available : null;
  const disk = this.storage(current('mounts'));
  if (state.system?.time !== this.ramTime) {
   if (this.ramTime && state.system.time - this.ramTime > 30000) this.ramHistory = metrics.append(this.ramHistory, null);
   this.ramHistory = metrics.append(this.ramHistory, memoryUsed === null ? null : memoryUsed / memory.total * 100);
   this.ramTime = state.system?.time;
  }
  const cpuPanel = section(_('CPU usage'), [
   E('strong', { 'class': 'zc-util-value' }, Number.isFinite(this.cpuBusy) ? number(this.cpuBusy) + '%' : '—'),
   Number.isFinite(this.cpuBusy) ? this.sparkline(this.cpuHistory, _('Recent CPU busy samples')) : null,
   E('p', { 'class': 'zc-note' }, cpuPending ? _('Waiting for the next CPU sample')
    : !Number.isFinite(this.cpuBusy) ? _('CPU data unavailable') : _('Busy time') + (cores ? ' · ' + cores + ' ' + _('cores') : ''))
  ], 'cpu');
  const ramPanel = section(_('RAM usage'), [
   E('strong', { 'class': 'zc-util-value' }, memoryUsed === null ? '—' : number(memoryUsed / memory.total * 100) + '%'),
   memoryUsed === null ? null : this.sparkline(this.ramHistory, _('Recent RAM usage samples')),
   E('p', { 'class': 'zc-note' }, memoryUsed === null ? _('Memory data unavailable')
    : mib(memory.available) + ' ' + _('available') + ' / ' + mib(memory.total) + ' ' + _('Linux RAM'))
  ], 'memory');
  deviceInfo.append(E('div', { 'class': 'zc-disk' }, [
   gauge(_('Disk'), disk.percent === null ? '—' : number(disk.percent) + '%', disk.percent,
    disk.percent === null ? _('Storage data unavailable') : mib(disk.avail) + ' ' + _('free') + ' / ' + mib(disk.total)),
   E('p', { 'class': 'zc-note' }, _('Writable overlay'))]));
  const nss4 = metrics.count(current('nss4')), nss6 = metrics.count(current('nss6'));
  const wan6 = (current('interfaces') || []).find(iface => iface.up === true &&
   [wan?.interface + '6', wan?.interface + '_6'].includes(iface.interface));
  const address4 = (wan?.['ipv4-address'] || []).map(a => a.address).filter(Boolean);
  const address6 = [...new Set((wan?.['ipv6-address'] || []).concat(wan6?.['ipv6-address'] || []).map(a => a.address).filter(Boolean))];
  const gateway = (wan?.route || []).find(route => route.target === '0.0.0.0' && route.mask === 0)?.nexthop;
  const connection = section(_('Network status'), [
   E('div', { 'class': 'zc-connection-heading' }, [
    status(wan ? (wan.up === true ? _('WAN up') : wan.up === false ? _('WAN down') : _('Unavailable'))
     : current('interfaces') ? _('No WAN configured') : _('Unavailable'), wan?.up === true ? 'up' : 'neutral'),
    E('span', { 'class': 'zc-note' }, wan?.proto ? wan.proto.toUpperCase() : '—')]),
   E('div', { 'class': 'zc-addresses' }, [pair(_('IPv4'), address4.join(', ') || '—'),
    pair(_('IPv6'), address6.join(', ') || '—'), pair(_('Gateway'), gateway || '—')]),
   E('div', { 'class': 'zc-acceleration', title: _('Active ECM flows; zero can be normal when idle.') }, [
    E('span', {}, _('NSS flows')), pair(_('IPv4'), nss4 === null ? _('Unavailable') : String(nss4)),
    pair(_('IPv6'), nss6 === null ? _('Unavailable') : String(nss6))])
  ], 'connection');
  const traffic = section(_('Network activity'), [
   E('div', { 'class': 'zc-traffic-values' }, [pair(_('Download'), rate(this.traffic?.down)), pair(_('Upload'), rate(this.traffic?.up))]),
   trafficMessage ? E('div', { 'class': 'zc-traffic-empty' }, trafficMessage) : this.chart(),
   E('div', { 'class': 'zc-chart-caption' }, [E('span', {}, trafficMessage ? _('No current rate')
    : _('Recent samples') + ' · ' + _('Scale') + ': ' + number(peak) + ' Mbps'),
    E('span', {}, wan?.l3_device || _('No WAN device'))]),
   E('p', { 'class': 'zc-note' }, _('WAN interface counters; accelerated traffic coverage is unverified.'))
  ], 'traffic');
  const logical = (current('interfaces') || []).filter(iface => iface.interface !== 'loopback');
  const interfacesSection = section(_('Interfaces'), [
   logical.length ? E('div', { 'class': 'zc-interfaces' }, logical.map(iface => {
    const addresses = (iface['ipv4-address'] || []).concat(iface['ipv6-address'] || []).map(a => a.address).filter(Boolean);
    return E('div', { 'class': 'zc-interface' }, [
     E('div', { 'class': 'zc-interface-heading' }, [E('strong', {}, iface.interface),
      status(iface.up === true ? _('Up') : iface.up === false ? _('Down') : _('Unavailable'), iface.up === true ? 'up' : 'neutral')]),
     E('div', { 'class': 'zc-interface-detail' }, [E('span', {}, [iface.proto, iface.l3_device || iface.device].filter(Boolean).join(' · ') || '—'),
      E('span', {}, addresses.join(' · ') || '—')])]);
   })) : E('p', { 'class': 'zc-note' }, current('interfaces') ? _('No interfaces configured') : _('Interface data unavailable')),
   E('p', { 'class': 'zc-note' }, _('Interface up does not verify Internet access.'))
  ], 'interfaces-section');
  const links = Object.entries(current('devices') || {}).filter(([name]) => /^(lan\d+|wan\d*)$/.test(name))
   .sort(([a], [b]) => Number(b.startsWith('wan')) - Number(a.startsWith('wan')) || a.localeCompare(b, undefined, { numeric: true }));
  const ports = section(_('Ports & Wi-Fi'), [
   links.length ? E('div', { 'class': 'zc-ports' }, links.map(([name, data]) => {
    const up = data.link?.carrier === true, down = data.link?.carrier === false;
    return E('div', { 'class': 'zc-port' + (up ? ' zc-port-up' : '') }, [
     E('span', { 'class': 'zc-port-socket', 'aria-hidden': 'true' }, [E('i'), E('i'), E('i'), E('i')]),
     E('div', {}, [E('strong', {}, name.toUpperCase()),
      E('span', {}, up ? (data.link.speed > 0 ? data.link.speed + ' Mbps' : _('Link up')) : down ? _('No link') : _('Unavailable'))])]);
   })) : E('p', { 'class': 'zc-note' }, _('No port status available')),
   E('div', { 'class': 'zc-wireless' }, Object.entries(current('wireless') || {}).map(([name, data]) => {
    const names = (data.interfaces || []).map(iface => iface.config?.ssid).filter(Boolean);
    const channel = data.iwinfo?.channel, frequency = data.iwinfo?.frequency;
    const band = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz' }[data.config?.band]
     || (frequency >= 5925 ? '6 GHz' : frequency >= 4900 ? '5 GHz' : frequency >= 2400 ? '2.4 GHz' : name);
    const disabled = data.disabled === true || data.config?.disabled === true || data.config?.disabled === '1';
    const noNetworks = data.up === true && Array.isArray(data.interfaces) && data.interfaces.length === 0;
    const text = disabled ? _('Disabled') : noNetworks ? _('No networks')
     : data.up === true ? _('Radio up') : data.up === false ? _('Down') : _('Unavailable');
    return E('div', { 'class': 'zc-radio' }, [
     E('div', { 'class': 'zc-radio-heading' }, [E('strong', {}, band), status(text, !disabled && !noNetworks && data.up === true ? 'up' : 'neutral')]),
     E('p', {}, [names.join(' · '), data.up === true && channel ? _('Channel') + ' ' + channel : ''].filter(Boolean).join(' · ') || name)]);
   }))
  ], 'ethernet');
  if (!Object.keys(current('wireless') || {}).length)
   ports.querySelector('.zc-wireless').append(E('p', { 'class': 'zc-note' }, _('No radio status available')));
  const dhcp = current('leases');
  const local = E('div', { 'class': 'zc-network-footer' }, [
   pair(_('IPv4 leases'), Array.isArray(dhcp?.dhcp_leases) ? String(dhcp.dhcp_leases.length) : '—'),
   pair(_('IPv6 leases'), Array.isArray(dhcp?.dhcp6_leases) ? String(dhcp.dhcp6_leases.length) : '—'),
   E('span', { 'class': 'zc-note' }, _('Leases are not a count of online clients.'))]);
  this.body.replaceChildren(
   E('div', { 'class': 'zc-pane zc-pane-device' }, [deviceInfo, connection]),
   E('div', { 'class': 'zc-pane zc-pane-network' }, [traffic, interfacesSection]),
   E('div', { 'class': 'zc-pane zc-pane-metrics' }, [cpuPanel, ramPanel, ports]), local);
 },

 storage(mountpoints) {
  const mount = (mountpoints || []).find(m => m.mount === '/overlay');
  const total = mount?.size, free = mount?.free, avail = mount?.avail ?? free;
  const valid = Number.isFinite(total) && total > 0 && Number.isFinite(free) && free >= 0 && free <= total;
  return { total, avail, percent: valid ? (total - free) / total * 100 : null };
 },
 sparkline(samples, label) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 160 48'); svg.setAttribute('class', 'zc-sparkline');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
  let connected = false, last = null;
  const points = samples.map((value, i) => {
   if (!Number.isFinite(value)) { connected = false; return ''; }
   const x = samples.length > 1 ? i * 160 / (samples.length - 1) : 160, y = 45 - Math.max(0, Math.min(100, value)) * .42;
   last = {x,y};
   const point = (connected ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
   connected = true; return point;
  }).join(' ');
  const path = document.createElementNS(ns, 'path'); path.setAttribute('d', points); svg.append(path);
  if (last) {
   const dot = document.createElementNS(ns, 'circle');
   dot.setAttribute('cx', last.x); dot.setAttribute('cy', last.y); dot.setAttribute('r', '1.4'); svg.append(dot);
  }
  return svg;
 },
 chart() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 600 150'); svg.setAttribute('class', 'zc-chart');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', _('Recent WAN download and upload samples'));
  const samples = this.history;
  const max = Math.max(1, ...samples.filter(Boolean).flatMap(s => [s.down, s.up]));
  ['down', 'up'].forEach(direction => {
   const path = document.createElementNS(ns, 'path');
   let connected = false;
   const points = samples.map((sample, i) => {
    if (!sample) { connected = false; return ''; }
    const point = (connected ? 'L' : 'M') + (i * 600 / Math.max(1, samples.length - 1)).toFixed(1) + ' ' + (145 - sample[direction] / max * 135).toFixed(1);
    connected = true; return point;
   }).join(' ');
   path.setAttribute('d', points); path.setAttribute('class', direction); svg.append(path);
  });
  return svg;
 },
 handleSaveApply: null,
 handleSave: null,
 handleReset: null
});
