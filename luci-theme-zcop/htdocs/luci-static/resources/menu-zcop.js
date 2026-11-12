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
  // LuCI adds its status indicators asynchronously, changing the space left
  // for tabs after initial render. Keep selected tabs visible on later resize.
  this.tabsObserver = new ResizeObserver(() => {
   document.querySelectorAll('#tabmenu .zcop-page-tabs').forEach(row => this.revealActiveTab(row));
  });
  this.tabsObserver.observe(document.querySelector('#tabmenu'));
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
  let groups = this.menuChildren(root).filter(node => node.name !== 'logout');
  groups = this.organizeStatus(groups, mode);
  const network = groups.find(group => group.name === 'network');
  const policies = network ? this.menuChildren(network).filter(child => /^(qos|sqm|qosify|nft-qos|cr881x[_-]yt921x[_-]qos)$/.test(child.name)) : [];
  const policyNames = new Set(policies.map(child => child.name));
  if (policies.length) {
   groups = groups.map(group => group !== network ? group : Object.assign({}, group, {
    children: Object.fromEntries(Object.entries(group.children || {}).filter(([name]) => !policyNames.has(name)))
   }));
   groups.splice(groups.findIndex(group => group.name === 'network') + 1, 0, {
    name: 'zcop_traffic', title: _('Traffic control'), children: Object.fromEntries(policies.map(child => [child.name, Object.assign({}, child, { zcopPath: [mode, 'network', child.name] })])),
    zcopPath: [mode, 'network', policies[0].name]
   });
  }
  const icons = { status: '◫', network: '⌘', services: '◇', system: '⚙', nas: '▤', vpn: '⇄', traffic: '≋' };
  const entries = groups.map(group => ({ node: group, path: this.entryPath(group, [mode]) }));
  const active = this.activeEntry(entries);
  entries.forEach(entry => {
   const group = entry.node, selected = entry === active;
   const title = group.name === 'status' ? _('Overview') : _(group.title);
   menu.append(E('a', {
    'class': 'zcop-navitem' + (selected ? ' active' : ''),
    'href': L.url.apply(L, entry.path),
    'aria-current': selected ? 'page' : null
   }, [E('span', { 'class': 'zcop-menu-icon', 'aria-hidden': 'true' }, icons[group.name] || '◇'),
    E('span', {}, title), E('span', { 'class': 'zcop-join', 'aria-hidden': 'true' })]));
   if (selected) this.renderPages(group, entry.path);
  });
  const brand = document.querySelector('.zcop-brand');
  const status = groups.find(group => group.name === 'status');
  if (status && this.menuChildren(status).some(child => child.name === 'zcop_dashboard'))
   brand.href = L.url(mode, 'status', 'zcop_dashboard');
 },

 // LuCI resolves aliases to their target children. Preserve an alias's own
 // permitted subpages (e.g. System/Kernel logs), otherwise use canonical child
 // URLs from its target. Never let later UI helper calls flatten the copy again.
 menuChildren(node) {
  return ui.menu.getChildren(node).map(page => {
   const raw = node.children?.[page.name];
   if (!raw?.action?.path || !['alias', 'rewrite'].includes(raw.action.type)) return page;
   const copy = Object.assign({}, page);
   if (Object.values(raw.children || {}).some(child => child.satisfied && Object.prototype.hasOwnProperty.call(child, 'title')))
    copy.children = raw.children;
   else copy.zcopChildrenPrefix = raw.action.path.split('/').filter(Boolean);
   delete copy.action;
   return copy;
  });
 },

 // Build a presentation tree from already-permitted entries. Actual routes,
 // source ACL flags and the registered menu tree are never rewritten.
 organizeStatus(groups, mode) {
  const status = groups.find(group => group.name === 'status');
  const pages = status ? this.menuChildren(status) : [];
  if (!pages.some(page => page.name === 'zcop_dashboard')) return groups;
  const imports = pages.filter(page => !['zcop_dashboard', 'overview', 'realtime'].includes(page.name))
   .map(page => Object.assign({}, page, { zcopPath: [mode, 'status', page.name] }));
  const systemNames = new Set(['logs', 'syslog', 'dmesg', 'processes']);
  const networkNames = new Set(['routes', 'routesj', 'iptables', 'nftables', 'channel_analysis', 'wireguard']);
  groups = groups.map(group => group === status ? Object.assign({}, group, {
   children: { zcop_dashboard: group.children.zcop_dashboard },
   zcopPath: [mode, 'status', 'zcop_dashboard'], zcopChildrenPrefix: [mode, 'status']
  }) : Object.assign({}, group, { children: Object.assign({}, group.children) }));
  const ensureGroup = (name, title, first) => {
   let group = groups.find(group => group.name === name);
   if (!group) {
    group = { name, title, satisfied: true, children: {}, zcopPath: first.zcopPath, zcopChildrenPrefix: [mode, name] };
    groups.push(group);
   }
   if (!this.menuChildren(group).length) { group.zcopPath = first.zcopPath; group.zcopChildrenPrefix = [mode, name]; }
   return group;
  };
  const system = imports.filter(page => systemNames.has(page.name));
  if (system.length) {
   const group = ensureGroup('system', _('System'), system[0]);
   system.forEach(page => { group.children['zcop_status_' + page.name] = Object.assign({}, page, {
    title: page.name === 'logs' ? _('Logs') : page.title,
    order: page.name === 'processes' ? 41 : 40
   }); });
  }
  const networkOrder = { routesj: 10, routes: 10, nftables: 20, iptables: 20, channel_analysis: 30, wireguard: 40 };
  const network = imports.filter(page => networkNames.has(page.name)).sort((a, b) => networkOrder[a.name] - networkOrder[b.name]);
  if (network.length) {
   const group = ensureGroup('network', _('Network'), network[0]);
   const native = this.menuChildren(group).find(page => page.name === 'diagnostics');
   const children = {};
   if (native) children.connectivity = Object.assign({}, native, { title: _('Connectivity'), order: 0, zcopPath: [mode, 'network', 'diagnostics'] });
   const titles = { routes: _('Routing table'), routesj: _('Routing table'), iptables: _('Firewall status'), nftables: _('Firewall status'), channel_analysis: _('Channel analysis'), wireguard: _('WireGuard status') };
   network.forEach(page => { children['zcop_status_' + page.name] = Object.assign({}, page, { title: titles[page.name], order: networkOrder[page.name] }); });
   group.children.diagnostics = { title: _('Diagnostics'), order: native?.order ?? 50, satisfied: true,
    zcopPath: native ? [mode, 'network', 'diagnostics'] : network[0].zcopPath, children };
  }
  const other = imports.filter(page => !systemNames.has(page.name) && !networkNames.has(page.name));
  if (other.length) {
   const group = ensureGroup('system', _('System'), other[0]);
   group.children.zcop_status_diagnostics = { title: _('Diagnostics'), order: 42, satisfied: true,
    zcopPath: other[0].zcopPath, children: Object.fromEntries(other.map(page => ['zcop_status_' + page.name, page])) };
  }
  return groups;
 },

 entryPath(node, prefix) { return node.zcopPath || prefix.concat(node.name); },
 matchScore(node, path) {
  let score = path.every((name, index) => L.env.dispatchpath[index] === name) ? path.length : 0;
  const prefix = node.zcopChildrenPrefix || path;
  this.menuChildren(node).forEach(child => { score = Math.max(score, this.matchScore(child, this.entryPath(child, prefix))); });
  return score;
 },
 activeEntry(entries) {
  let active = null, best = 0, bestDirect = 0;
  entries.forEach(entry => {
   const score = this.matchScore(entry.node, entry.path);
   const direct = entry.path.every((name, index) => L.env.dispatchpath[index] === name) ? entry.path.length : 0;
   // An alias may expose a canonical page also owned by another group.
   // Prefer that page's own ancestor over the shortcut when scores tie.
   if (score > best || score > 0 && score === best && direct > bestDirect) { best = score; bestDirect = direct; active = entry; }
  });
  return active;
 },

 revealActiveTab(row) {
  const current = row.querySelector('a[aria-current=page]');
  if (!current) return;
  const item = current.getBoundingClientRect(), bounds = row.getBoundingClientRect();
  if (item.right > bounds.right) row.scrollLeft += item.right - bounds.right;
  else if (item.left < bounds.left) row.scrollLeft += item.left - bounds.left;
 },

 renderPages(node, path) {
  const children = this.menuChildren(node);
  if (!children.length) return;
  const entries = children.map(child => ({ node: child, path: this.entryPath(child, node.zcopChildrenPrefix || path) }));
  const activeEntry = this.activeEntry(entries), active = activeEntry?.node;
  const row = E('ul', { 'class': 'tabs zcop-page-tabs' });
  entries.forEach(entry => {
   const child = entry.node, selected = entry === activeEntry;
   row.append(E('li', { 'class': selected ? 'active' : '' }, [
    E('a', { 'href': L.url.apply(L, entry.path), 'aria-current': selected ? 'page' : null },
     entry.path[1] === 'status' && child.name === 'overview' ? _('System details') : _(child.title))
   ]));
  });
  document.querySelector('#tabmenu').append(row);
  this.revealActiveTab(row);
  if (active) {
   this.renderPages(active, activeEntry.path);
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
