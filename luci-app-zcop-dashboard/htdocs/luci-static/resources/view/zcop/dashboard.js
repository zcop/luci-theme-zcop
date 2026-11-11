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
function pair(label, value) { return E('div', { 'class': 'zc-datum' }, [E('span', {}, label), E('strong', {}, value)]); }
function widget(title, content) { return E('section', { 'class': 'zc-widget' }, [E('h3', {}, title), ...content]); }

return view.extend({
 load() { return L.resolveDefault(board(), {}); },
 render(identity) {
  if (!document.querySelector('#zcop-dashboard-style'))
   document.head.append(E('link', { id: 'zcop-dashboard-style', rel: 'stylesheet', href: L.resource('zcop/dashboard.css') }));
  this.state = {};
  this.due = {};
  this.latestDevice = null;
  this.history = [];
  this.generation = 0;
  this.failures = {};
  this.body = E('div', { 'class': 'zc-dashboard-grid' });
  this.status = E('span', { 'class': 'zc-refresh-status', 'role': 'status' }, _('Collecting initial snapshot…'));
  this.scheduler = new Scheduler(() => this.collect(), () => {
   this.generation++;
   this.cpuBaseline = this.wanBaseline = null;
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
   E('div', { 'class': 'zc-dashboard-meta' }, [E('span', {}, identity.model || identity.hostname || _('Router')), this.status, cadence,
    E('button', { 'type': 'button', 'class': 'btn', 'click': () => this.scheduler.refresh() }, _('Refresh')), pause]),
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
  const traffic = widget(_('WAN traffic'), [
   E('div', { 'class': 'zc-traffic-values' }, [pair(_('Download'), number(this.traffic?.down) + ' Mbps'), pair(_('Upload'), number(this.traffic?.up) + ' Mbps')]),
   this.chart(), E('p', { 'class': 'zc-note' }, _('Reported interface counters · NSS coverage not yet validated. No persistent history.'))
  ]);
  traffic.classList.add('zc-traffic');
  const system = widget(_('System headroom'), [
   pair(_('CPU busy'), number(this.cpuBusy) + '%'),
   pair(_('Available memory'), mib(memory.available)),
   E('p', { 'class': 'zc-note' }, _('Linux memory total') + ': ' + mib(memory.total)),
   pair(_('Uptime'), Number.isFinite(current('system')?.uptime) ? Math.floor(current('system').uptime / 3600) + ' h' : '—'),
   pair(_('Writable storage free'), this.storage(current('mounts')))
  ]);
  const links = Object.entries(current('devices') || {}).filter(([name]) => /^(lan\d+|wan\d*)$/.test(name));
  const ports = widget(_('Ethernet links'), links.length ? links.map(([name, data]) => pair(name.toUpperCase(),
   data.link?.carrier ? (data.link.speed > 0 ? data.link.speed + ' Mbps' : _('Link up')) : _('No link'))) : [E('p', {}, _('No port status available'))]);
  const radios = Object.entries(current('wireless') || {});
  const wifi = widget(_('Wireless'), radios.length ? radios.map(([name, data]) => {
   const names = (data.interfaces || []).map(iface => iface.config?.ssid).filter(Boolean);
   const channel = data.iwinfo?.channel;
   return pair(name + (names.length ? ' · ' + names.join(', ') : ''), data.up ? _('Up') + (channel ? ' · ' + _('Channel') + ' ' + channel : '') : _('Down'));
  }) : [E('p', {}, _('No radio status available'))]);
  const dhcp = current('leases');
  const local = widget(_('Local network'), [pair(_('IPv4 leases'), dhcp ? String(dhcp.dhcp_leases?.length || 0) : '—'),
   pair(_('IPv6 leases'), dhcp ? String(dhcp.dhcp6_leases?.length || 0) : '—'),
   E('p', { 'class': 'zc-note' }, _('Leases are not a count of online clients.'))]);
  const nss4 = metrics.count(current('nss4')), nss6 = metrics.count(current('nss6'));
  const connection = widget(_('Connection'), [pair(_('WAN'), wan ? (wan.up ? _('Ready') : _('Down')) + ' · ' + (wan.proto || '—') : _('Unavailable')),
   pair(_('Accelerated flows · IPv4'), nss4 === null ? _('Unavailable') : String(nss4)), pair(_('Accelerated flows · IPv6'), nss6 === null ? _('Unavailable') : String(nss6)),
   E('p', { 'class': 'zc-note' }, _('WAN ready means interface configured; no Internet probe runs.'))]);
  this.body.replaceChildren(connection, traffic, system, ports, wifi, local);
 },

 storage(mountpoints) {
  const mount = (mountpoints || []).find(m => m.mount === '/overlay');
  return mount ? mib(mount.avail ?? mount.free) : _('Unavailable');
 },
 chart() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 600 150'); svg.setAttribute('class', 'zc-chart');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', _('Recent WAN download and upload samples'));
  const samples = this.history;
  const max = Math.max(1, ...samples.filter(Boolean).flatMap(s => [s.down, s.up]));
  ['down', 'up'].forEach(direction => {
   const path = document.createElementNS(ns, 'path');
   let connected = false;
   const points = samples.map((sample, i) => {
    if (!sample) { connected = false; return ''; }
    const point = (connected ? 'L' : 'M') + (i * 600 / 59).toFixed(1) + ' ' + (145 - sample[direction] / max * 135).toFixed(1);
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
