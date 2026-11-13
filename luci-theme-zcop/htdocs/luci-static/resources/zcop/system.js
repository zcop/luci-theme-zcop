'use strict';
'require baseclass';
/* SPDX-License-Identifier: Apache-2.0
 * Presentation only: retain native form nodes, widgets and handlers. */
return baseclass.extend({
 __init__() {
  if(document.body.dataset.page!=='admin-system-system')return;
  const view=document.querySelector('#view');if(!view)return;
  if(!document.querySelector('#zcop-system-style'))document.head.append(E('link',{id:'zcop-system-style',rel:'stylesheet',href:L.resource('zcop/system.css')}));
  const refresh=()=>{
   this.observer?.disconnect();
   try{this.decorate(view);}finally{this.observer?.observe(view,{childList:true,subtree:true});}
  };
  this.observer=new MutationObserver(refresh);refresh();
  window.addEventListener('pagehide',()=>this.observer.disconnect(),{once:true});
 },
 decorate(view) {
  const map=view.querySelector('#cbi-system');
  if(!map||!map.querySelector('[data-tab="general"] .cbi-value[data-name="hostname"]'))return;
  const groups={
   general:[['device',_('Device'),['hostname','description','notes']],['clock',_('Clock'),['_systime','zonename','clock_hourcycle','clock_timestyle']]],
   language:[['interface',_('Interface'),['_lang','_mediaurlbase','_tablefilters']]],
   logging:[['logging',_('Logging'),['log_size','log_file','conloglevel','cronloglevel','log_ip','log_port','log_proto']]],
   timesync:[['service',_('Time service'),['enabled','enable_server','interface','use_dhcp']],['sources',_('Time sources'),['server']]],
   zram:[['memory',_('Compressed memory'),['zram_size_mb','zram_comp_algo']]]
  };
  const labels={log_size:_('Buffer size (KiB)'),log_file:_('Log file'),log_ip:_('Remote server'),log_port:_('Port'),log_proto:_('Protocol'),conloglevel:_('Kernel log level'),cronloglevel:_('Cron log level'),clock_timestyle:_('Full timezone name'),clock_hourcycle:_('Time format'),_mediaurlbase:_('Theme'),enabled:_('NTP client'),enable_server:_('NTP server'),interface:_('Listen interfaces'),use_dhcp:_('Use DHCP servers'),server:_('Servers')};
  for(const node of map.querySelectorAll('.cbi-section-node-tabbed')){
   node.classList.add('zc-system-root');
   for(const pane of node.children){
    const name=pane.getAttribute('data-tab');
    if(!name||pane.querySelector(':scope > .zc-system-panels'))continue;
    const definitions=groups[name];if(!definitions)continue;
    const rows=[...pane.children].filter(e=>e.matches('.cbi-value[data-name]'));
    const panels=E('div',{'class':'zc-system-panels'});
    for(const [key,title,fields]of definitions){
     const selected=fields.map(field=>rows.find(row=>row.dataset.name===field)).filter(Boolean);if(!selected.length)continue;
     const id=pane.id+'-zc-'+key;
     const section=E('section',{'class':'zc-system-pane zc-system-'+key,'aria-labelledby':id},E('h3',{id},title));
     for(const row of selected){
      const field=row.dataset.name,label=row.querySelector(':scope > .cbi-value-title');
      if(label&&labels[field])label.textContent=labels[field];
      // Explanations that only repeat a field's name or unit add no information.
      if(['description','notes','log_size','conloglevel','clock_timestyle','server'].includes(field))row.querySelector('.cbi-value-description')?.classList.add('zc-system-redundant');
      if(field==='log_ip')row.classList.add('zc-system-divider');
      if(field==='_systime'){
       row.classList.add('zc-system-clock-row');
       const time=row.querySelector('#localtime');if(time&&label)time.setAttribute('aria-label',label.textContent);
      }
      section.append(row);
     }
     panels.append(section);
    }
    if(panels.childElementCount)pane.prepend(panels);
   }
  }
  map.classList.add('zc-system-properties');
 }
});
