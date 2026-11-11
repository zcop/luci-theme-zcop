/* SPDX-License-Identifier: Apache-2.0 */
(function () {
 'use strict';
 const key = 'zcop.theme';
 function apply(mode) {
  if (!['light', 'dark', 'luxury'].includes(mode)) mode = 'light';
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.darkmode = String(mode !== 'light');
  document.querySelectorAll('[data-zcop-palette]').forEach(button => {
   button.setAttribute('aria-pressed', String(button.dataset.zcopPalette === mode));
  });
 }
 let mode;
 try { mode = localStorage.getItem(key); } catch (_) {}
 apply(mode || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
 document.addEventListener('DOMContentLoaded', () => {
  apply(document.documentElement.dataset.theme);
  document.addEventListener('click', event => {
   const button = event.target.closest('[data-zcop-palette]');
   if (!button) return;
   apply(button.dataset.zcopPalette);
   try { localStorage.setItem(key, button.dataset.zcopPalette); } catch (_) {}
  });
 });
})();
