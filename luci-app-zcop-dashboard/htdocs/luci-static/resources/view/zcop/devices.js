'use strict';
'require view';
'require rpc';
'require fs';
'require uci';
'require ui';
'require form';
'require zcop.devices as devices';
'require zcop.scheduler as Scheduler';
/* SPDX-License-Identifier: Apache-2.0 */
const leases = rpc.declare({ object:'luci-rpc', method:'getDHCPLeases', expect:{'':{}}, reject:true });
const config = rpc.declare({ object:'uci', method:'get', params:['config'], expect:{'':{}}, reject:true });
const interfaces = rpc.declare({ object:'network.interface', method:'dump', expect:{interface:[]}, reject:true });
const sourceNames = {static:_('Static'),dhcp4:_('DHCPv4'),dhcp6:_('DHCPv6'),neighbour:_('Neighbour')};
const stateNames = {REACHABLE:_('Recently reachable'),STALE:_('Stale (cached)'),DELAY:_('Checking'),PROBE:_('Checking'),FAILED:_('Unreachable'),INCOMPLETE:_('Unresolved'),PERMANENT:_('Permanent'),NOARP:_('No ARP'),UNKNOWN:_('Unknown')};
const elapsed = seconds => seconds === false ? _('Unlimited') : seconds === null ? _('Unknown') : seconds <= 0 ? _('Expired') :
 seconds >= 3600 ? Math.floor(seconds/3600)+'h '+Math.floor(seconds%3600/60)+'m' : Math.floor(seconds/60)+'m '+seconds%60+'s';

return view.extend({
 render() {
  if (!document.querySelector('#zcop-devices-style'))
   document.head.append(E('link',{id:'zcop-devices-style',rel:'stylesheet',href:L.resource('zcop/devices.css')}));
  this.state = {}; this.failures = {}; this.rows = []; this.page = 0; this.writable = L.hasViewPermission() === true;
  this.scheduler = Scheduler.create(() => this.collect(), () => {}); this.scheduler.interval = 30000; this.scheduler.hidden = document.hidden;
  this.search = E('input',{type:'search',placeholder:_('Search name, MAC or address'),'aria-label':_('Search devices'),input:()=>{this.page=0;this.draw();}});
  this.filter = E('select',{'aria-label':_('Device source'),change:()=>{this.page=0;this.draw();}},[
   E('option',{value:''},_('All sources')),E('option',{value:'static'},_('Static leases')),E('option',{value:'dhcp'},_('DHCP leases')),E('option',{value:'neighbour'},_('Neighbours')),E('option',{value:'stale'},_('Stale neighbours'))]);
  this.count = E('span',{'class':'zc-devices-count','role':'status'},_('Collecting devices…'));
  this.status = E('span',{'class':'zc-devices-refresh','role':'status'},_('Collecting initial snapshot…'));
  this.warning = E('p',{'class':'zc-devices-warning','role':'status'});
  this.body = E('tbody');
  this.navigation = E('div',{'class':'zc-devices-navigation'});
  this.actions = E('span',{'class':'zc-devices-actions'});
  this.pause = E('button',{type:'button','class':'btn','aria-pressed':'false',click:()=>{
   const paused = !this.scheduler.paused; this.scheduler.pause(paused);
   this.pause.setAttribute('aria-pressed',String(paused));this.pause.textContent=paused?_('Resume'):_('Pause');
   this.status.textContent=paused?_('Paused'):_('Refreshing…');
  }},_('Pause'));
  const cadence = E('select',{'aria-label':_('Device refresh interval'),change:event=>this.scheduler.setInterval(Number(event.target.value))},[
   E('option',{value:'30000'},_('30 seconds')),E('option',{value:'60000'},_('60 seconds')),E('option',{value:'0'},_('Manual'))]);
  const controls = E('div',{'class':'zc-devices-controls'},[this.status,cadence,E('button',{type:'button','class':'btn',click:()=>this.scheduler.refresh()},_('Refresh')),this.pause]);
  const root = E('div',{'class':'zc-devices'},[
   E('h2',{'class':'zcop-sr-only'},_('Devices')),
   E('div',{'class':'zc-devices-toolbar'},[this.count,this.search,this.filter,this.actions]),
   E('p',{'class':'zc-devices-help'},_('Known devices from DHCP leases, static reservations and neighbour caches. A lease does not prove a device is online; stale means its cached reachability has not been confirmed recently.')),
   this.warning,
   E('table',{'class':'zc-devices-table'},[E('thead',{},E('tr',{},[_('Device'),_('Addresses / interface'),_('Assignment'),_('Neighbour state'),_('Lease remaining'),_('Static lease')].map(label=>E('th',{},label)))),this.body]),
   this.navigation]);
  const footer=document.querySelector('.zcop-footer'); if(footer){footer.classList.add('zc-devices-footer');footer.append(controls);}else root.append(controls);
  ui.menu.load().then(tree=>{
   if(tree.children?.admin?.children?.network?.children?.dhcp?.satisfied){
    this.dhcpUrl=L.url('admin','network','dhcp');this.actions.append(E('a',{href:this.dhcpUrl},_('DHCP settings')));this.draw();
   }
  }).catch(()=>{});
  this.visibility=()=>this.scheduler.visibility(document.hidden);document.addEventListener('visibilitychange',this.visibility);
  window.addEventListener('pagehide',()=>{this.scheduler.stop();document.removeEventListener('visibilitychange',this.visibility);},{once:true});
  this.draw();this.scheduler.plan(0);return root;
 },
 snapshot() { return {leases:this.state.leases?.value,leaseTime:this.state.leases?.time,config:this.state.config?.value,interfaces:this.state.interfaces?.value,
  neighbours4:this.state.neighbours4?.value,neighbours6:this.state.neighbours6?.value}; },
 async collect() {
  const commands = {leases:()=>leases(),config:()=>config('dhcp'),interfaces:()=>interfaces(),
   neighbours4:()=>fs.exec('/sbin/ip',['-4','neigh','show']),neighbours6:()=>fs.exec('/sbin/ip',['-6','neigh','show'])};
  let successful=0;
  await Promise.all(Object.entries(commands).map(async([key,call])=>{
   try{
    const response=await call();
    if(key.startsWith('neighbours')&&response.code!==0)throw Error('Neighbour snapshot failed');
    this.state[key]={value:key.startsWith('neighbours')?response.stdout:response,time:Date.now()};delete this.failures[key];successful++;
   }catch(_){this.failures[key]=true;}
  }));
  this.rows=devices.combine(this.snapshot());this.draw();
  this.status.textContent=Object.keys(this.failures).length?_('Some sources unavailable; retained rows are from their last snapshot.'):_('Updated')+' '+new Date().toLocaleTimeString();
  if(!successful)throw Error('Device sources unavailable');
 },
 draw() {
  if(!this.body)return;
  const snapshot=this.snapshot(),pools=devices.pools(snapshot.config,snapshot.interfaces),query=(this.search.value||'').trim().toLowerCase(),filter=this.filter.value;
  const rows=this.rows.filter(row=>(!query||[row.name,...row.macs,...row.duids,...row.ipv4,...row.ipv6,...row.devices].join(' ').toLowerCase().includes(query))&&
   (!filter||(filter==='dhcp'?row.leases.length:filter==='stale'?row.states.includes('STALE'):row.sources.includes(filter))));
  this.count.textContent=!Object.keys(this.state).length?(Object.keys(this.failures).length?_('Device data unavailable'):_('Collecting devices…')):
   this.rows.length+' '+_('known')+' · '+this.rows.filter(r=>r.reservations.length).length+' '+_('with static leases');
  this.warning.textContent=Object.keys(this.failures).length?_('Some sources could not be read. Cached rows may be outdated; refresh before changing reservations.'):'';
  this.warning.hidden=!this.warning.textContent;
  const pages=Math.max(1,Math.ceil(rows.length/50));this.page=Math.min(this.page,pages-1);
  this.body.replaceChildren();
  for(const row of rows.slice(this.page*50,this.page*50+50)){
   const addressNodes=row.ipv4.concat(row.ipv6).map(ip=>E('span',{},ip+(row.reservations.some(r=>r.ip===ip)?' · '+_('reserved'):'')));
   if(row.devices.length)addressNodes.push(E('small',{},row.devices.join(', ')));
   const currentLeases=row.leases.map(l=>E('span',{},'IPv'+l.family+': '+elapsed(devices.remaining(l,Date.now()))));
   const source=row.sources.filter(s=>s!=='neighbour'||row.sources.length===1).map(s=>sourceNames[s]);
   const states=row.states.map(s=>stateNames[s]||s);
   let action=E('span',{},'—');
   const candidate=row.ipv4.find(ip=>devices.inPool(ip,pools));
   if(row.reservations.length&&this.dhcpUrl)action=E('a',{href:this.dhcpUrl},_('Manage'));
   else if(this.writable&&row.macs.length&&candidate&&!row.reservations.length)action=E('button',{type:'button','class':'btn',disabled:['config','interfaces','leases'].some(key=>this.failures[key])?'disabled':null,click:()=>this.reserve(row,candidate)},_('Set static lease'));
   else if(!row.reservations.length&&row.leases.some(l=>l.family===6)&&this.dhcpUrl)action=E('a',{href:this.dhcpUrl},_('DHCP settings'));
   this.body.append(E('tr',{},[
    E('td',{'data-label':_('Device')},[E('strong',{},row.name||_('Unnamed device')),...row.macs.map(m=>E('small',{},m)),...(!row.macs.length?row.duids.map(d=>E('small',{title:d},'DUID '+d)):[])]),
    E('td',{'data-label':_('Addresses / interface')},addressNodes.length?addressNodes:'—'),E('td',{'data-label':_('Assignment')},source.join(' · ')||'—'),
    E('td',{'data-label':_('Neighbour state')},states.length?states.join(', '):_('Unknown')),E('td',{'data-label':_('Lease remaining')},currentLeases.length?currentLeases:'—'),
    E('td',{'data-label':_('Static lease')},action)]));
  }
  if(!rows.length)this.body.append(E('tr',{},E('td',{colspan:6},Object.keys(this.state).length?_('No matching devices.'):Object.keys(this.failures).length?_('Device information unavailable.'):_('Collecting device information…'))));
  this.navigation.replaceChildren(E('span',{},rows.length?_('Showing')+' '+(this.page*50+1)+'–'+Math.min(rows.length,this.page*50+50)+' / '+rows.length:_('No rows')));
  if(pages>1)this.navigation.append(E('button',{type:'button','class':'btn',disabled:this.page===0?'disabled':null,click:()=>{this.page--;this.draw();}},_('Previous')),
   E('button',{type:'button','class':'btn',disabled:this.page===pages-1?'disabled':null,click:()=>{this.page++;this.draw();}},_('Next')));
 },
 async reserve(row,ip) {
  if(!this.writable||this.editing)return;
  this.editing=true;const wasPaused=this.scheduler.paused;this.scheduler.pause(true);
  const finish=()=>{this.editing=false;ui.hideModal();if(!wasPaused)this.scheduler.pause(false);};
  const map=new form.JSONMap({lease:{name:row.name,mac:row.macs[0],ip}});
  const section=map.section(form.NamedSection,'lease','lease');
  const name=section.option(form.Value,'name',_('Hostname'));name.datatype='hostname';name.rmempty=true;
  const hardware=section.option(form.Value,'mac',_('MAC address'));hardware.datatype='macaddr';hardware.rmempty=false;
  const address=section.option(form.Value,'ip',_('IPv4 address'));address.datatype='ip4addr';address.rmempty=false;
  const error=E('p',{'class':'zc-devices-warning','role':'alert'});
  const cancel=E('button',{type:'button','class':'btn',click:finish},_('Cancel'));
  let attempted=false,saving=false;
  const save=E('button',{type:'button','class':'cbi-button cbi-button-positive',click:async()=>{
   if(saving||attempted)return;
   saving=true;cancel.disabled=save.disabled=true;error.textContent='';
   try{
    await map.save(null,true);
    const values={name:map.data.get('json','lease','name'),mac:map.data.get('json','lease','mac'),ip:map.data.get('json','lease','ip')};
    const [fresh,net,currentLeases]=await Promise.all([config('dhcp'),interfaces(),leases()]);
    const invalid=devices.reservationError(values,fresh,devices.pools(fresh,net),currentLeases);
    if(invalid)throw Error(_(invalid.message));
    uci.unload('dhcp');await uci.load('dhcp');
    const id=uci.add('dhcp','host');uci.set('dhcp',id,'mac',[devices.mac(values.mac)]);uci.set('dhcp',id,'ip',values.ip.trim());
    if(values.name){uci.set('dhcp',id,'name',values.name);uci.set('dhcp',id,'dns','1');}
    attempted=true;await uci.save();await ui.changes.init();finish();
    Promise.resolve(ui.changes.displayChanges()).catch(e=>ui.addNotification(null,E('p',{},e.message)));
   }catch(e){
    error.textContent=attempted?_('Could not confirm the saved change. Review pending changes before trying again.'):e.message;
    if(attempted){uci.unload('dhcp');ui.changes.init().catch(()=>{});}else save.disabled=false;
   }finally{saving=false;cancel.disabled=false;}
  }},_('Save for review'));
  try{ui.showModal(_('Set static lease'),[
   E('p',{},_('Reserve an IPv4 address in OpenWrt DHCP. Saving stages the change; use LuCI Save & Apply after reviewing pending changes.')),
   await map.render(),error,E('div',{'class':'right'},[cancel,save])]);}
  catch(e){finish();ui.addNotification(null,E('p',{},e.message));}
 },
 handleSaveApply:null,handleSave:null,handleReset:null
});
