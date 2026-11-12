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
 wan(interfaces) {
  return interfaces.find(n => n.interface === 'wan') || interfaces.find(n =>
   (n.route || []).some(r => r.target === '0.0.0.0' || r.target === '::')) || null;
 }
});
