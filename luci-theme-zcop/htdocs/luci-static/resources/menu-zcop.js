'use strict';
'require baseclass';
'require ui';

/* SPDX-License-Identifier: Apache-2.0 */
return baseclass.extend({
 __init__() {
  this.toggle = document.querySelector('.zcop-menu-toggle');
  this.toggle.addEventListener('click', () => {
   const open = document.body.classList.toggle('zcop-menu-open');
   this.toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', event => {
   if (event.key === 'Escape' && document.body.classList.contains('zcop-menu-open')) {
    document.body.classList.remove('zcop-menu-open');
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.focus();
   }
  });
  ui.menu.load().then(tree => this.render(tree)).catch(() => {
   document.querySelector('#topmenu').append(E('p', {}, _('Navigation could not be loaded. Reload this page.')));
  });
 },

 render(tree) {
  const path = L.env.dispatchpath;
  const mode = path[0] || 'admin';
  const root = tree.children && tree.children[mode];
  if (!root) return;
  const menu = document.querySelector('#topmenu');
  let groups = ui.menu.getChildren(root).filter(node => node.name !== 'logout');
  // Overview is the new dashboard entry point. Keep the registered tree and
  // routes intact; use the original menu when the dashboard is not permitted.
  groups = groups.map(group => group.name === 'status' && ui.menu.getChildren(group).some(child => child.name === 'zcop_dashboard')
   ? Object.assign({}, group, { children: { zcop_dashboard: group.children.zcop_dashboard } }) : group);
  const network = groups.find(group => group.name === 'network');
  const policies = network ? ui.menu.getChildren(network).filter(child => /^(qos|sqm|qosify|nft-qos|cr881x[_-]yt921x[_-]qos)$/.test(child.name)) : [];
  const policyNames = new Set(policies.map(child => child.name));
  if (policies.length) {
   groups = groups.map(group => group !== network ? group : Object.assign({}, group, {
    children: Object.fromEntries(Object.entries(group.children || {}).filter(([name]) => !policyNames.has(name)))
   }));
   groups.splice(groups.findIndex(group => group.name === 'network') + 1, 0, {
    name: 'zcop_traffic', title: _('Traffic control'), children: Object.fromEntries(policies.map(child => [child.name, child])),
    zcopPath: [mode, 'network', policies[0].name]
   });
  }
  const icons = { status: '◫', network: '⌘', services: '◇', system: '⚙', nas: '▤', vpn: '⇄', traffic: '≋' };
  groups.forEach(group => {
   let target = group.zcopPath || [mode, group.name];
   if (group.name === 'status' && ui.menu.getChildren(group).some(child => child.name === 'zcop_dashboard'))
    target.push('zcop_dashboard');
   const selected = group.name === 'zcop_traffic' ? path[1] === 'network' && policyNames.has(path[2])
    : group.name === path[1] && !(group.name === 'network' && policyNames.has(path[2]));
   const title = group.name === 'status' ? _('Overview') : _(group.title);
   menu.append(E('a', {
    'class': 'zcop-navitem' + (selected ? ' active' : ''),
    'href': L.url.apply(L, target),
    'aria-current': selected ? 'page' : null
   }, [E('span', { 'class': 'zcop-menu-icon', 'aria-hidden': 'true' }, icons[group.name] || '◇'),
    E('span', {}, title), E('span', { 'class': 'zcop-join', 'aria-hidden': 'true' })]));
   if (selected) this.renderPages(group, [mode, group.zcopPath ? 'network' : group.name], 2);
  });
  const brand = document.querySelector('.zcop-brand');
  const status = groups.find(group => group.name === 'status');
  if (status && ui.menu.getChildren(status).some(child => child.name === 'zcop_dashboard'))
   brand.href = L.url(mode, 'status', 'zcop_dashboard');
 },

 renderPages(node, prefix, depth) {
  const children = ui.menu.getChildren(node);
  if (!children.length) return;
  const row = E('ul', { 'class': 'tabs zcop-page-tabs' });
  let active;
  children.forEach(child => {
   const selected = L.env.dispatchpath[depth] === child.name;
   row.append(E('li', { 'class': selected ? 'active' : '' }, [
    E('a', { 'href': L.url.apply(L, prefix.concat(child.name)), 'aria-current': selected ? 'page' : null },
     prefix[1] === 'status' && child.name === 'overview' ? _('System details') : _(child.title))
   ]));
   if (selected) active = child;
  });
  document.querySelector('#tabmenu').append(row);
  if (active) {
   this.renderPages(active, prefix.concat(active.name), depth + 1);
   // Preserve headings for accessibility; avoid repeating the selected page.
   const deduplicate = () => {
    const heading = document.querySelector('#view > h2, #view > .cbi-map > h2, .zcop-content > .cbi-map > h2');
    if (heading && heading.textContent.trim() === _(active.title))
     heading.classList.add('zcop-sr-only');
   };
   document.addEventListener('luci-loaded', deduplicate, { once: true });
   deduplicate();
  }
 }
});
