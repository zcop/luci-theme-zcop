'use strict';
/* SPDX-License-Identifier: Apache-2.0. Pure calculations, no I/O. */
return {
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
};
