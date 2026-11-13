'use strict';
'require baseclass';
/* SPDX-License-Identifier: Apache-2.0. Pure calculations, no I/O. */
return baseclass.extend({
 processor(cpuinfo, present, maxFrequency, fallback) {
  const explicit = /^CPU architecture\s*:\s*(\d+(?:\.\d+)?)\s*$/mi.exec(cpuinfo || '');
  const model = /\bARMv(\d+(?:\.\d+)?)/i.exec(cpuinfo || fallback || '');
  let architecture = explicit ? 'ARMv' + explicit[1] : model ? 'ARMv' + model[1] : fallback || null;
  // CPU revision/variant are not architecture minor versions.
  if (explicit && model && model[1].includes('.') && model[1].split('.')[0] === explicit[1]) architecture = 'ARMv' + model[1];
  const ids = new Set();
  const list = String(present || '').trim().split(',');
  const valid = list.every(range => {
   const match = /^(\d+)(?:-(\d+))?$/.exec(range.trim());
   if (!match) return false;
   const first = Number(match[1]), last = Number(match[2] ?? match[1]);
   if (first > last || last > 4095) return false;
   for (let id = first; id <= last; id++) ids.add(id);
   return true;
  });
  const listed = [...String(cpuinfo || '').matchAll(/^processor\s*:\s*(\d+)\s*$/gm)].map(match => match[1]);
  const cores = valid && ids.size ? ids.size : listed.length ? new Set(listed).size : null;
  const khz = /^\d+$/.test(String(maxFrequency || '').trim()) ? Number(String(maxFrequency).trim()) : null;
  return { architecture, cores, maxKHz: Number.isSafeInteger(khz) && khz > 0 ? khz : null };
 },
 cpu(text) {
  const match = /^cpu\s+(.+)$/m.exec(text || '');
  if (!match) return null;
  // guest/guest_nice are already included in user/nice; do not count twice.
  const values = match[1].trim().split(/\s+/).slice(0, 8).map(Number);
  if (values.length < 4 || values.some(n => !Number.isFinite(n) || n < 0)) return null;
  return { total: values.reduce((a, b) => a + b, 0), idle: values[3] + (values[4] || 0) };
 },
 cpuPercent(previous, current) {
  if (!previous || !current) return null;
  const total = current.total - previous.total;
  const idle = current.idle - previous.idle;
  if (total <= 0 || idle < 0 || idle > total) return null;
  return 100 * (total - idle) / total;
 },
 rate(previous, current) {
  if (!previous || !current || previous.device !== current.device) return null;
  const seconds = (current.time - previous.time) / 1000;
  const rx = current.rx - previous.rx, tx = current.tx - previous.tx;
  if (seconds <= 0 || seconds > 30 || rx < 0 || tx < 0 || ![rx, tx].every(Number.isFinite)) return null;
  return { time: current.time, down: rx * 8 / seconds / 1000000, up: tx * 8 / seconds / 1000000 };
 },
 append(history, sample) {
  return history.concat([sample]).slice(-60);
 },
 count(text) {
  return /^\d+\s*$/.test(text || '') ? Number(text.trim()) : null;
 },
 portRoles(status, devices) {
  const ports = Object.keys(devices || {}).filter(name => /^(lan\d+|wan\d*)$/.test(name));
  const split = value => typeof value === 'string' ? value.trim().split(/\s+/).filter(n => n && n !== '<unset>') : [];
  // Physical socket names never imply a role. The live bridge is authoritative
  // for LAN membership; the WAN Mode helper supplies configured WAN devices.
  const bridge = devices?.['br-lan'];
  const lan = Array.isArray(bridge?.ports) ? bridge.ports : split(status?.br_lan_ports);
  const lanKnown = Array.isArray(bridge?.ports) || lan.length > 0;
  const known = status?.ok === true && typeof status.wan === 'string' && typeof status.wan2 === 'string';
  const assignments = [['lan', lan], ['wan1', split(status?.wan)], ['wan2', split(status?.wan2)]];
  const physical = device => {
   if (ports.includes(device)) return device;
   // Explicit VLAN uppers can share a socket. Do not guess through PPP, bonds,
   // tunnels or arbitrary bridge names when the physical device is unreported.
   const match = /^(lan\d+|wan\d*)((?:\.\d{1,4}){1,2})$/.exec(device);
   return match && ports.includes(match[1]) && match[2].slice(1).split('.').every(n => Number(n) >= 1 && Number(n) <= 4094) ? match[1] : null;
  };
  const unresolved = assignments.slice(1).some(([, names]) => names.some(n => !physical(n)));
  return Object.fromEntries(ports.map(name => {
   if (!known) return [name, { roles: [], state: 'unknown' }];
   const roles = assignments.filter(([, names]) => names.some(n => physical(n) === name)).map(([role]) => role);
   const direct = assignments.filter(([, names]) => names.includes(name)).length;
   return [name, { roles, state: direct > 1 ? 'conflict' : roles.length > 1 ? 'shared'
    : roles.length ? 'assigned' : lanKnown && !unresolved ? 'other' : 'unknown' }];
  }));
 },
 portLabels(roles) {
  const names = Object.keys(roles || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  let lastLan = Math.max(0, ...names.map(name => Number(/^lan(\d+)$/.exec(name)?.[1] || 0)));
  // Keep existing LAN numbering stable. WAN Mode also identifies the fourth
  // socket as LAN4 when it joins LAN; labels never rename the backing device.
  return Object.fromEntries(names.map(name => {
   const lan = /^lan\d+$/.test(name) ? name.toUpperCase() : 'LAN' + ++lastLan;
   return [name, roles[name].roles.map(role => role === 'lan' ? lan : role.toUpperCase()).join(' / ')];
  }));
 },
 wan(interfaces) {
  // Follow the live uplink rather than a configured socket name. IPv4 and
  // IPv6 metrics are separate; prefer IPv4, then the lowest metric in-family.
  let uplink = null, family = 2, metric = Infinity;
  for (const iface of interfaces) {
   if (iface.up !== true) continue;
   for (const route of iface.route || []) {
    if (Number(route.mask ?? 0) !== 0) continue;
    const nextFamily = route.target === '0.0.0.0' ? 0 : route.target === '::' ? 1 : 2;
    const nextMetric = Number(route.metric ?? iface.metric ?? 0);
    if (nextFamily === 2 || !Number.isFinite(nextMetric) || nextMetric < 0) continue;
    if (!uplink || nextFamily < family || nextFamily === family &&
     (nextMetric < metric || nextMetric === metric && iface.interface === 'wan' && uplink.interface !== 'wan')) {
     uplink = iface; family = nextFamily; metric = nextMetric;
    }
   }
  }
  // Preserve configured-WAN status/errors when no active default is reported.
  return uplink || interfaces.find(iface => iface.interface === 'wan') || null;
 }
});
