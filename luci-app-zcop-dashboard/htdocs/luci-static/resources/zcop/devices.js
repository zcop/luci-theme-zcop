'use strict';
'require baseclass';
/* SPDX-License-Identifier: Apache-2.0. Passive snapshots; no discovery probes. */
const list = value => Array.isArray(value) ? value : typeof value === 'string' ? value.trim().split(/\s+/).filter(Boolean) : [];
const mac = value => {
 const text = String(value || '').toLowerCase();
 return /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(text) && !(parseInt(text.slice(0,2),16) & 1) && text !== '00:00:00:00:00:00' ? text : null;
};
const ipv4 = value => {
 const words = String(value || '').split('.');
 return words.length === 4 && words.every(w => /^(0|[1-9][0-9]{0,2})$/.test(w) && Number(w) <= 255) ? words.map(Number) : null;
};
const number = words => words.reduce((n, word) => n * 256 + word, 0);
const sections = config => Object.entries(config?.values || {}).filter(([,value])=>value&&typeof value==='object').map(([id, value]) => Object.assign({}, value, { '.name': value['.name'] || id }));
const addresses = value => list(value).map(a => String(a).split('/')[0].toLowerCase()).filter(Boolean);
const duid = value => String(value || '').replace(/:/g, '').toLowerCase();
const cleanName = value => value && value !== '*' ? String(value) : '';

return baseclass.extend({
 mac, ipv4, sections,
 neighbours(text) {
  return String(text || '').trim().split('\n').filter(Boolean).map(line => {
   const words = line.trim().split(/\s+/), dev = words.indexOf('dev'), ll = words.indexOf('lladdr');
   const state = words.find(w => /^(REACHABLE|STALE|DELAY|PROBE|FAILED|INCOMPLETE|PERMANENT|NOARP)$/.test(w));
   return { address: words[0], device: dev >= 0 ? words[dev+1] : '', mac: ll >= 0 ? mac(words[ll+1]) : null, state: state || 'UNKNOWN' };
  }).filter(n => n.address && n.device);
 },
 pools(config, interfaces) {
  const enabled = sections(config).filter(s => s['.type'] === 'dhcp' && s.ignore !== '1' && s.dhcpv4 !== 'disabled').map(s => s.interface || s['.name']);
  return (interfaces || []).filter(i => enabled.includes(i.interface)).flatMap(i => (i['ipv4-address'] || []).flatMap(a => {
   const words = ipv4(a.address), mask = Number(a.mask);
   if (!words || !Number.isInteger(mask) || mask < 1 || mask > 30) return [];
   const size = 2 ** (32-mask), network = Math.floor(number(words) / size) * size;
   return [{ interface: i.interface, device: i.l3_device || i.device, address: a.address, network, broadcast: network + size - 1 }];
  }));
 },
 inPool(address, pools) {
  const words = ipv4(address); if (!words || words[0] === 0 || words[0] === 127 || words[0] >= 224) return false;
  const value = number(words);
  return !pools.some(p => p.address === address) && pools.some(p => value > p.network && value < p.broadcast);
 },
 reservationError(values, config, pools, leases) {
  const address = String(values.ip || '').trim(), hardware = mac(values.mac);
  if (!hardware) return { field: 'mac', message: 'Enter a unicast MAC address.' };
  if (!this.inPool(address, pools)) return { field: 'ip', message: 'Choose a host address in a local DHCP-served subnet, excluding the router address.' };
  for (const host of sections(config).filter(s => s['.type'] === 'host')) {
   if (list(host.mac).some(m => {
    const pattern = String(m).toLowerCase().split(':');
    return pattern.length === 6 && pattern.every((part, i) => part === '*' || part === hardware.split(':')[i]);
   })) return { field: 'mac', message: 'This MAC address already matches a configured static lease. Manage it in DHCP settings.' };
   if (list(host.ip).includes(address)) return { field: 'ip', message: 'This address is already reserved by another static lease.' };
  }
  if ((leases?.dhcp_leases || []).some(l => l.ipaddr === address && mac(l.macaddr) !== hardware && (l.expires === false || l.expires > 0)))
   return { field: 'ip', message: 'This address is currently leased to a different MAC address.' };
  return null;
 },
 combine(snapshot) {
  const events = [], parent = new Map(), leaseKeys = [];
  const root = key => {
   if (!parent.has(key)) parent.set(key, key);
   let r = key; while (parent.get(r) !== r) r = parent.get(r);
   while (parent.get(key) !== key) { const next = parent.get(key); parent.set(key,r); key = next; }
   return r;
  };
  const join = keys => { const first = root(keys[0]); keys.slice(1).forEach(k => parent.set(root(k),first)); return first; };
  const add = event => { root(event.key); events.push(event); };
  for (const family of [4,6]) for (const lease of snapshot.leases?.[family === 4 ? 'dhcp_leases' : 'dhcp6_leases'] || []) {
   const hardware = mac(lease.macaddr), id = duid(lease.duid), iaid = String(lease.iaid || '').toLowerCase();
   const ips = addresses(family === 4 ? lease.ipaddr : lease.ip6addrs || lease.ip6addr);
   const dk = id ? 'duid:' + id + '%' + iaid : null;
   const key = hardware ? 'mac:' + hardware : dk || 'lease:' + family + ':' + ips.join(',') + ':' + (lease.interface || '');
   if (hardware && dk) join([key,dk]);
   if (dk) leaseKeys.push({duid:id,iaid,key:dk});
   add({ key, mac: hardware, duid: id, name: cleanName(lease.hostname), family, ips,
    lease: { family, expires: lease.expires, captured: snapshot.leaseTime, interface: lease.interface || '' } });
  }
  for (const n of this.neighbours(snapshot.neighbours4).concat(this.neighbours(snapshot.neighbours6)))
   add({ key: n.mac ? 'mac:' + n.mac : 'unresolved:' + n.device + ':' + n.address, mac: n.mac, ips: [n.address], family: n.address.includes(':') ? 6 : 4, neighbour: n });
  for (const host of sections(snapshot.config).filter(s => s['.type'] === 'host')) {
   const key = 'static:' + host['.name'], hardware = list(host.mac).map(mac).filter(Boolean), keys = [key,...hardware.map(m => 'mac:' + m)];
   for (const value of list(host.duid)) {
    const [id, iaid] = value.toLowerCase().split('%'), normalized = duid(id);
    const found = leaseKeys.filter(k => k.duid === normalized && (!iaid || k.iaid === iaid));
    keys.push(...(found.length ? found.map(k => k.key) : ['duid:' + normalized + '%' + (iaid || '')]));
   }
   join(keys);
   add({ key, macs: hardware, name: cleanName(host.name), family: 4, ips: addresses(host.ip).filter(ip => ipv4(ip)), reservation: host });
  }
  const rows = new Map();
  for (const e of events) {
   const key = root(e.key);
   if (!rows.has(key)) rows.set(key, { key, name:'', macs:new Set(), duids:new Set(), ipv4:new Set(), ipv6:new Set(), leases:[], neighbours:[], reservations:[] });
   const row = rows.get(key);
   if (e.name && (!row.name || e.reservation)) row.name = e.name;
   (e.macs || [e.mac]).filter(Boolean).forEach(m => row.macs.add(m));
   if (e.duid) row.duids.add(e.duid);
   e.ips.forEach(ip => row[e.family === 4 ? 'ipv4' : 'ipv6'].add(ip));
   if (e.lease) row.leases.push(e.lease);
   if (e.neighbour) row.neighbours.push(e.neighbour);
   if (e.reservation) row.reservations.push(e.reservation);
  }
  return [...rows.values()].map(row => Object.assign(row, {
   macs:[...row.macs],duids:[...row.duids],ipv4:[...row.ipv4],ipv6:[...row.ipv6],
   states:[...new Set(row.neighbours.map(n => n.state))],
   devices:[...new Set(row.neighbours.map(n => n.device))],
   sources:[...(row.reservations.length ? ['static'] : []),...(row.leases.some(l => l.family === 4) ? ['dhcp4'] : []),...(row.leases.some(l => l.family === 6) ? ['dhcp6'] : []),...(row.neighbours.length ? ['neighbour'] : [])]
  })).sort((a,b) => (a.name || a.macs[0] || a.ipv4[0] || a.ipv6[0] || a.key).localeCompare(b.name || b.macs[0] || b.ipv4[0] || b.ipv6[0] || b.key,undefined,{numeric:true,sensitivity:'base'}));
 },
 remaining(lease, now) {
  if (lease.expires === false) return false;
  return Number.isFinite(lease.expires) ? Math.max(0, Math.floor(lease.expires - Math.max(0,now-(lease.captured || now))/1000)) : null;
 }
});
