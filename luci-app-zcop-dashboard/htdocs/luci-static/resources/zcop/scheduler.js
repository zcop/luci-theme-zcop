'use strict';
'require baseclass';
/* SPDX-License-Identifier: Apache-2.0. One timer and one collector in flight. */
class Scheduler {
 constructor(collect, reset, environment) {
  this.collect = collect;
  this.reset = reset;
  this.env = environment || window;
  this.interval = 5000;
  this.paused = false;
  this.hidden = false;
  this.stopped = false;
  this.busy = false;
  this.failures = 0;
  this.timer = null;
 }
 cancel() { if (this.timer !== null) this.env.clearTimeout(this.timer); this.timer = null; }
 plan(delay) {
  this.cancel();
  if (!this.stopped && !this.paused && !this.hidden && this.interval)
   this.timer = this.env.setTimeout(() => this.refresh(), delay);
 }
 async refresh() {
  this.cancel();
  if (this.stopped || this.paused || this.hidden || this.busy) return;
  this.busy = true;
  try { await this.collect(); this.failures = 0; }
  catch (_) { this.failures = Math.min(3, this.failures + 1); }
  finally { this.busy = false; this.plan(Math.max(this.interval || 0, Math.min(60000, (this.interval || 5000) * 2 ** this.failures))); }
 }
 setInterval(milliseconds) {
  this.interval = milliseconds;
  this.reset();
  this.plan(milliseconds);
 }
 pause(paused) {
  this.paused = paused;
  this.cancel();
  this.reset();
  if (!paused) this.plan(0);
 }
 visibility(hidden) {
  this.hidden = hidden;
  this.cancel();
  this.reset();
  if (!hidden) this.plan(0);
 }
 stop() { this.stopped = true; this.cancel(); this.reset(); }
};

return baseclass.extend({
 create(collect, reset, environment) { return new Scheduler(collect, reset, environment); }
});
