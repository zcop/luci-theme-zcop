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
function widget(title, content, kind) { return E('section', { 'class': 'zc-widget zc-' + kind }, [E('h3', {}, title), ...content]); }
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
  this.state = {};
  this.due = {};
  this.latestDevice = null;
  this.history = [];
  this.generation = 0;
  this.failures = {};
  this.body = E('div', { 'class': 'zc-dashboard-grid' });
  this.status = E('span', { 'class': 'zc-refresh-status', 'role': 'status' }, _('Collecting initial snapshot…'));
  this.scheduler = Scheduler.create(() => this.collect(), () => {
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
   E('div', { 'class': 'zc-dashboard-meta' }, [
    E('div', { 'class': 'zc-dashboard-title' }, [E('h3', {}, _('Network overview')),
     E('span', {}, identity.model || identity.hostname || _('Router'))]),
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
  const cpuPending = cpu && this.cpuBaseline && !Number.isFinite(this.cpuBusy);
  const traffic = widget(_('WAN traffic'), [
   E('div', { 'class': 'zc-traffic-values' }, [pair(_('Download'), rate(this.traffic?.down)), pair(_('Upload'), rate(this.traffic?.up))]),
   trafficMessage ? E('div', { 'class': 'zc-traffic-empty' }, trafficMessage) : this.chart(),
   E('div', { 'class': 'zc-chart-caption' }, [E('span', {}, trafficMessage ? _('No current rate')
    : _('Recent samples') + ' · ' + _('Scale') + ': ' + number(peak) + ' Mbps'),
    E('span', {}, wan?.l3_device || _('No WAN device'))]),
   E('p', { 'class': 'zc-note' }, _('Reported interface counters; NSS coverage is unverified. History stays in this browser.'))
  ], 'traffic');
  const system = widget(_('Router health'), [
   gauge(_('CPU busy'), Number.isFinite(this.cpuBusy) ? number(this.cpuBusy) + '%' : '—', this.cpuBusy,
    cpuPending ? _('Waiting for the next CPU sample') : !Number.isFinite(this.cpuBusy) ? _('CPU data unavailable') : null),
   gauge(_('Available memory'), mib(memory.available), memory.total > 0 && Number.isFinite(memory.available)
    ? memory.available / memory.total * 100 : null, _('Linux memory total') + ': ' + mib(memory.total)),
   E('div', { 'class': 'zc-system-details' }, [pair(_('Uptime'), uptime(current('system')?.uptime)),
    pair(_('Writable storage free'), this.storage(current('mounts')))])
  ], 'system');
  const links = Object.entries(current('devices') || {}).filter(([name]) => /^(lan\d+|wan\d*)$/.test(name))
   .sort(([a], [b]) => Number(b.startsWith('wan')) - Number(a.startsWith('wan')) || a.localeCompare(b, undefined, { numeric: true }));
  const ports = widget(_('Ethernet ports'), [links.length ? E('div', { 'class': 'zc-ports' }, links.map(([name, data]) => {
   const carrier = data.link?.carrier;
   const up = carrier === true, down = carrier === false;
   return E('div', { 'class': 'zc-port' + (up ? ' zc-port-up' : '') }, [
    E('span', { 'class': 'zc-port-socket', 'aria-hidden': 'true' }, [E('i'), E('i'), E('i'), E('i')]),
    E('strong', {}, name.toUpperCase()),
    E('span', {}, up ? (data.link.speed > 0 ? data.link.speed + ' Mbps' : _('Link up')) : down ? _('No link') : _('Unavailable'))]);
  })) : E('p', { 'class': 'zc-note' }, _('No port status available'))], 'ethernet');
  const radios = Object.entries(current('wireless') || {});
  const wifi = widget(_('Wi-Fi radios'), radios.length ? radios.map(([name, data]) => {
   const names = (data.interfaces || []).map(iface => iface.config?.ssid).filter(Boolean);
   const channel = data.iwinfo?.channel;
   const frequency = data.iwinfo?.frequency;
   const band = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz' }[data.config?.band]
    || (frequency >= 5925 ? '6 GHz' : frequency >= 4900 ? '5 GHz' : frequency >= 2400 ? '2.4 GHz' : name);
   const disabled = data.disabled === true || data.config?.disabled === true || data.config?.disabled === '1';
   const noNetworks = data.up === true && Array.isArray(data.interfaces) && data.interfaces.length === 0;
   const text = disabled ? _('Disabled') : noNetworks ? _('No networks')
    : data.up === true ? _('Radio up') : data.up === false ? _('Down') : _('Unavailable');
   return E('div', { 'class': 'zc-radio' }, [
    E('div', { 'class': 'zc-radio-heading' }, [E('strong', {}, band), status(text, !disabled && !noNetworks && data.up === true ? 'up' : 'neutral')]),
    E('p', {}, names.length ? names.join(' · ') : name),
    data.up === true && channel ? E('span', { 'class': 'zc-note' }, _('Channel') + ' ' + channel) : null]);
  }) : [E('p', { 'class': 'zc-note' }, _('No radio status available'))], 'wireless');
  const dhcp = current('leases');
  const local = E('div', { 'class': 'zc-network-footer' }, [
   pair(_('IPv4 leases'), Array.isArray(dhcp?.dhcp_leases) ? String(dhcp.dhcp_leases.length) : '—'),
   pair(_('IPv6 leases'), Array.isArray(dhcp?.dhcp6_leases) ? String(dhcp.dhcp6_leases.length) : '—'),
   E('span', { 'class': 'zc-note' }, _('Leases are not a count of online clients.'))]);
  const nss4 = metrics.count(current('nss4')), nss6 = metrics.count(current('nss6'));
  const addresses = (wan?.['ipv4-address'] || []).concat(wan?.['ipv6-address'] || []).map(a => a.address).filter(Boolean);
  const connection = E('section', { 'class': 'zc-connection', 'aria-label': _('Connection summary') }, [
   E('div', {}, [E('span', { 'class': 'zc-eyebrow' }, _('WAN connection')),
    status(wan ? (wan.up === true ? _('Interface up') : wan.up === false ? _('Interface down') : _('Unavailable'))
     : current('interfaces') ? _('Not configured') : _('Unavailable'), wan?.up === true ? 'up' : 'neutral'),
    E('span', { 'class': 'zc-note' }, wan?.proto ? wan.proto.toUpperCase() : '—')]),
   E('div', { 'class': 'zc-addresses' }, [E('span', { 'class': 'zc-eyebrow' }, _('Assigned addresses')),
    E('strong', {}, addresses.length ? addresses.join(' · ') : '—')]),
   E('div', { 'class': 'zc-acceleration', title: _('Active ECM flows; zero can be normal when idle.') }, [E('span', { 'class': 'zc-eyebrow' }, _('NSS accelerated flows')),
    pair(_('IPv4'), nss4 === null ? _('Unavailable') : String(nss4)),
    pair(_('IPv6'), nss6 === null ? _('Unavailable') : String(nss6))])]);
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
  svg.setAttribute('preserveAspectRatio', 'none');
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
