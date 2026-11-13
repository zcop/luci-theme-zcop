'use strict';
'require view';
'require rpc';
'require fs';
'require uci';
'require ui';
'require form';
'require zcop.devices as devices';
'require zcop.vendors as vendors';
'require zcop.scheduler as Scheduler';
/* SPDX-License-Identifier: Apache-2.0 */
const leases = rpc.declare({ object:'luci-rpc', method:'getDHCPLeases', expect:{'':{}}, reject:true });
const config = rpc.declare({ object:'uci', method:'get', params:['config'], expect:{'':{}}, reject:true });
const interfaces = rpc.declare({ object:'network.interface', method:'dump', expect:{interface:[]}, reject:true });
const wireless = rpc.declare({ object:'luci-rpc', method:'getWirelessDevices', expect:{'':{}}, reject:true });
const associations = rpc.declare({ object:'iwinfo', method:'assoclist', params:['device'], expect:{results:[]}, reject:true });
const sourceNames = {static:_('Static'),mapping:_('DHCP mapping'),ignored:_('DHCP ignored'),saved:_('Saved name'),dhcp4:_('DHCPv4'),dhcp6:_('DHCPv6'),neighbour:_('Neighbour'),fdb:_('Learned MAC'),wifi:_('Local Wi-Fi')};
const stateNames = {REACHABLE:_('Recently reachable'),STALE:_('Stale (cached)'),DELAY:_('Checking'),PROBE:_('Checking'),FAILED:_('Unreachable'),INCOMPLETE:_('Unresolved'),PERMANENT:_('Permanent'),NOARP:_('No ARP'),UNKNOWN:_('Unknown')};
const elapsed = seconds => seconds === false ? _('Unlimited') : seconds === null ? _('Unknown') : seconds <= 0 ? _('Expired') :
 seconds >= 3600 ? Math.floor(seconds/3600)+'h '+Math.floor(seconds%3600/60)+'m' : Math.floor(seconds/60)+'m '+seconds%60+'s';

return view.extend({
 render() {
  if (!document.querySelector('#zcop-devices-style'))
   document.head.append(E('link',{id:'zcop-devices-style',rel:'stylesheet',href:L.resource('zcop/devices.css')+'?v=0.8.0'}));
  this.state = {}; this.failures = {}; this.rows = []; this.page = 0; this.writable = L.hasViewPermission() === true;
  this.disposed=false;this.vendorRegistry=vendors.create();this.vendorResults=new Map();this.vendorMode='manual';
  try{if(localStorage.getItem('zcop-vendor-lookup-mode')==='auto')this.vendorMode='auto';}catch(_){}
  this.vendorChoice=E('select',{'aria-label':_('Vendor lookup mode'),title:_('Download a public prefix database to this browser. Device MAC addresses are never sent to a vendor lookup service.'),change:event=>{
   this.vendorMode=event.target.value;try{localStorage.setItem('zcop-vendor-lookup-mode',this.vendorMode);}catch(_){}this.draw();
  }},[E('option',{value:'manual'},_('Manual')),E('option',{value:'auto'},_('Automatic'))]);this.vendorChoice.value=this.vendorMode;
  this.vendorButton=E('button',{type:'button','class':'btn',click:()=>this.lookupVendors(this.visibleMACs||[])},_('Look up visible'));
  this.vendorNotice=E('p',{'class':'zc-devices-vendor-notice',role:'status'});
  this.scheduler = Scheduler.create(() => this.collect(), () => {}); this.scheduler.interval = 30000; this.scheduler.hidden = document.hidden;
  this.search = E('input',{type:'search',placeholder:_('Name, MAC, vendor, IP or port'),'aria-label':_('Search devices'),input:()=>{this.page=0;this.draw();}});
  this.filter = E('select',{'aria-label':_('Device source'),change:()=>{this.page=0;this.draw();}},[
   E('option',{value:''},_('All sources')),E('option',{value:'static'},_('Static leases')),E('option',{value:'dhcp'},_('DHCP leases')),E('option',{value:'wifi'},_('Local Wi-Fi')),E('option',{value:'fdb'},_('Learned MACs')),E('option',{value:'saved'},_('Saved names')),E('option',{value:'neighbour'},_('Neighbours')),E('option',{value:'stale'},_('Stale neighbours'))]);
  this.count = E('span',{'class':'zc-devices-count','role':'status'},_('Collecting devices…'));
  this.status = E('span',{'class':'zc-devices-refresh','role':'status'},_('Collecting initial snapshot…'));
  this.warning = E('p',{'class':'zc-devices-warning','role':'status'});
  this.body = E('tbody'); this.navigation = E('div',{'class':'zc-devices-navigation'}); this.actions = E('span',{'class':'zc-devices-actions'});
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
   E('div',{'class':'zc-devices-toolbar'},[this.count,this.search,this.filter,E('label',{'class':'zc-devices-vendor-mode'},[E('span',{},_('Vendors')),this.vendorChoice]),this.vendorButton,this.actions]),
   E('p',{'class':'zc-devices-help'},_('Passive DHCP, neighbour, forwarding and local Wi-Fi snapshots. “Seen via” identifies a router port, not a downstream device’s connection type. A lease or learned MAC does not prove a device is online.')),
   this.vendorNotice,this.warning,
   E('table',{'class':'zc-devices-table'},[E('thead',{},E('tr',{},[_('Device'),_('Addresses'),_('Connection'),_('Assignment'),_('Lease remaining'),_('Actions')].map(label=>E('th',{},label)))),this.body]),
   this.navigation]);
  const footer=document.querySelector('.zcop-footer'); if(footer){footer.classList.add('zc-devices-footer');footer.append(controls);}else root.append(controls);
  ui.menu.load().then(tree=>{
   if(tree.children?.admin?.children?.network?.children?.dhcp?.satisfied){
    this.dhcpUrl=L.url('admin','network','dhcp');this.actions.append(E('a',{href:this.dhcpUrl},_('DHCP settings')));this.draw();
   }
  }).catch(()=>{});
  this.visibility=()=>this.scheduler.visibility(document.hidden);document.addEventListener('visibilitychange',this.visibility);
  window.addEventListener('pagehide',()=>{this.disposed=true;this.vendorRegistry.stop();this.scheduler.stop();document.removeEventListener('visibilitychange',this.visibility);},{once:true});
  this.draw();this.scheduler.plan(0);return root;
 },
 snapshot() { return {leases:this.state.leases?.value,leaseTime:this.state.leases?.time,config:this.state.config?.value,interfaces:this.state.interfaces?.value,
  aliases:this.state.aliases?.value,neighbours4:this.state.neighbours4?.value,neighbours6:this.state.neighbours6?.value,
  fdb:this.state.fdb?.value,fdbFresh:!this.failures.fdb,wifi:this.state.wifi?.value,wifiFresh:!this.failures.wifi}; },
 async collect() {
  if(this.editing||this.body?.querySelector('.zc-device-actions[open]'))return;
  const commands = {leases:()=>leases(),config:()=>config('dhcp'),aliases:()=>config('zcop_devices'),interfaces:()=>interfaces(),
   neighbours4:()=>fs.exec('/sbin/ip',['-4','neigh','show']),neighbours6:()=>fs.exec('/sbin/ip',['-6','neigh','show']),
   fdb:()=>fs.exec('/usr/sbin/bridge',['fdb','show']),
   wifi:async()=>{
    const aps=devices.apInterfaces(await wireless());
    return devices.wifiPeers(await Promise.all(aps.map(async ap=>Object.assign({},ap,{stations:await associations(ap.ifname)}))));
   }};
  let successful=0;
  await Promise.all(Object.entries(commands).map(async([key,call])=>{
   try{
    const response=await call(),command=key.startsWith('neighbours')||key==='fdb';
    if(command&&response.code!==0)throw Error('Snapshot failed');
    this.state[key]={value:command?response.stdout:response,time:Date.now()};delete this.failures[key];successful++;
   }catch(_){this.failures[key]=true;}
  }));
  this.rows=devices.combine(this.snapshot());this.draw();
  this.status.textContent=Object.keys(this.failures).length?_('Some sources unavailable; retained rows are from their last snapshot.'):_('Updated')+' '+new Date().toLocaleTimeString();
  if(!successful)throw Error('Device sources unavailable');
 },
 connection(row,snapshot) {
  const proof=devices.connection(row,snapshot),nodes=[];
  if(proof.peers)for(const peer of proof.peers){
   const cached=proof.kind==='wifi-cached';
   nodes.push(E('span',{'class':'zc-device-badge'},cached?_('Local Wi-Fi · cached'):_('Local Wi-Fi')),
    E('small',{},[peer.ssid,peer.band,peer.ap].filter(Boolean).join(' · ')));
   if(!cached){
    const rates=[peer.signal!=null?peer.signal+' dBm':null,peer.tx!=null?'Tx '+peer.tx.toFixed(1):null,peer.rx!=null?'Rx '+peer.rx.toFixed(1):null].filter(Boolean);
    nodes.push(E('small',{title:_('Tx/Rx are radio link rates at the router, not measured throughput.')},rates.length?rates.join(' · ')+(peer.tx!=null||peer.rx!=null?' Mbit/s':''):_('Radio details unavailable')));
   }
  }
  else if(proof.kind==='path'||proof.kind==='path-cached'){
   nodes.push(E('span',{'class':'zc-device-badge'},_('Seen via')+' '+proof.paths.map(p=>/^lan\d+$/.test(p)?p.toUpperCase():p).join(', ')));
   nodes.push(E('small',{},proof.kind==='path-cached'?_('Last forwarding snapshot'):_('Downstream connection unknown')));
  }
  else nodes.push(E('span',{},_('Connection unknown')));
  if(row.devices.length)nodes.push(E('small',{},row.devices.join(', ')));
  if(row.states.length)nodes.push(E('small',{},row.states.map(s=>stateNames[s]||s).join(', ')));
  return nodes;
 },
 rowActions(row,pools) {
  const actions={},choices={},add=(key,label,run)=>{choices[key]=label;actions[key]=run;};
  if(this.writable&&!this.failures.aliases&&(row.macs.length||row.duidIds.length)){
   if(!row.aliases.length)add('name',_('Set friendly name'),()=>this.friendlyName(row));
   row.aliases.forEach((alias,i)=>add('name'+i,_('Edit name')+(row.aliases.length>1?' · '+alias.name:''),()=>this.friendlyName(row,alias)));
  }
  if(this.writable&&!['config','interfaces','leases'].some(key=>this.failures[key])){
   const host=devices.simpleReservation(row),candidate=row.ipv4.find(ip=>devices.inPool(ip,pools));
   if(host)add('reserve',_('Edit static lease'),()=>this.reserve(row,host.ip,host));
   else if(row.macs.length&&candidate&&!row.reservations.length)add('reserve',_('Set static lease'),()=>this.reserve(row,candidate));
  }
  if(row.reservations.length&&this.dhcpUrl)add('dhcp',_('DHCP settings'),()=>{window.location.href=this.dhcpUrl;});
  if(row.macs.length)add('mac',_('Copy MAC address'),()=>this.copy(row.macs.join('\n')));
  if(row.ipv4.length||row.ipv6.length)add('addresses',_('Copy addresses'),()=>this.copy(row.ipv4.concat(row.ipv6).join('\n')));
  if(!Object.keys(choices).length)return E('span',{},'—');
  const widget=new ui.Dropdown(null,choices,{optional:true,sort:Object.keys(choices),select_placeholder:_('Actions'),create:false}),node=widget.render();
  node.classList.add('btn','zc-device-actions');node.setAttribute('aria-label',_('Actions for')+' '+(row.name||row.macs[0]||row.ipv4[0]||row.ipv6[0]));
  node.addEventListener('cbi-dropdown-close',()=>{setTimeout(()=>{if(this.redrawPending&&!this.editing)this.draw();},0);});
  node.addEventListener('cbi-dropdown-change',event=>{const action=actions[event.detail.value?.value];if(action){widget.setValue(null);action();}});
  return node;
 },
 macIdentity(mac) {
  const type=vendors.classify(mac),result=this.vendorResults.get(mac),upper=mac.toUpperCase();
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const[key,value]of Object.entries({viewBox:'0 0 14 14',width:'12',height:'12',fill:'none',stroke:'currentColor','stroke-width':'1.1','aria-hidden':'true'}))icon.setAttribute(key,value);
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M4 4h8v8H4z M2 9V2h7');icon.append(path);
  const copy=E('button',{type:'button','class':'zc-device-mac',title:_('Copy MAC address'),'aria-label':_('Copy MAC ')+upper,click:()=>this.copy(upper)},[
   E('span',{},[upper]),E('span',{'class':'zc-device-mac-copy','aria-hidden':'true'},icon)]);
  let detail;
  if(type==='private')detail=E('span',{},[_('Private / locally administered')]);
  else if(type!=='global')detail=E('span',{},[_('Vendor unavailable')]);
  else if(result?.state==='found')detail=E('span',{title:_('Registered prefix owner; this may differ from the device brand.')},[result.name]);
  else if(result?.state==='unknown')detail=E('span',{},[_('Vendor not in database')]);
  else if(result?.state==='loading')detail=E('span',{},[_('Looking up vendor…')]);
  else if(this.vendorMode==='manual'||result?.state==='error')detail=E('button',{type:'button','class':'zc-device-vendor-query',disabled:this.vendorBusy?'disabled':null,click:()=>this.lookupVendors([mac])},result?.state==='error'?_('Retry vendor lookup'):_('Look up vendor'));
  else detail=E('span',{},[_('Vendor not yet looked up')]);
  return E('div',{'class':'zc-device-mac-block'},[copy,E('div',{'class':'zc-device-vendor'},detail)]);
 },
 async lookupVendors(values) {
  if(this.vendorBusy||this.disposed||document.hidden)return;
  const macs=[...new Set(values)].filter(m=>vendors.classify(m)==='global').slice(0,256);
  if(!macs.length)return;
  this.vendorBusy=true;this.vendorError=null;macs.forEach(mac=>this.vendorResults.set(mac,{state:'loading'}));this.draw();
  try{
   await this.vendorRegistry.load();if(this.disposed)return;
   macs.forEach(mac=>this.vendorResults.set(mac,this.vendorRegistry.find(mac)));
  }catch(_){this.vendorError=true;macs.forEach(mac=>this.vendorResults.set(mac,{state:'error'}));}
  finally{this.vendorBusy=false;if(!this.disposed)this.draw();}
 },
 async copy(text) {
  try{if(!navigator.clipboard)throw Error();await navigator.clipboard.writeText(text);ui.addNotification(null,E('p',{},_('Copied.')),'info');}
  catch(_){ui.showModal(_('Copy device details'),[E('textarea',{readonly:'readonly',rows:Math.min(8,text.split('\n').length+1),'aria-label':_('Device details')},text),E('div',{'class':'right'},E('button',{type:'button','class':'btn',click:()=>ui.hideModal()},_('Close')))]);}
 },
 draw() {
  if(!this.body||this.disposed)return;
  if(this.body.querySelector('.zc-device-actions[open]')){this.redrawPending=true;return;}this.redrawPending=false;
  const snapshot=this.snapshot(),pools=devices.pools(snapshot.config,snapshot.interfaces),query=(this.search.value||'').trim().toLowerCase(),filter=this.filter.value;
  const rows=this.rows.filter(row=>(!query||[row.name,row.reportedName,...row.macs,...row.duids,...row.ipv4,...row.ipv6,...row.devices,...row.forwards.map(f=>f.device),...row.wireless.map(w=>w.ssid),...row.macs.map(m=>this.vendorResults.get(m)?.name||'')].join(' ').toLowerCase().includes(query))&&
   (!filter||(filter==='dhcp'?row.leases.length:filter==='stale'?row.states.includes('STALE'):row.sources.includes(filter))));
  this.count.textContent=!Object.keys(this.state).length?(Object.keys(this.failures).length?_('Device data unavailable'):_('Collecting devices…')):
   this.rows.length+' '+_('known')+' · '+this.rows.filter(r=>r.sources.includes('static')).length+' '+_('with static leases');
  this.warning.textContent=Object.keys(this.failures).length?_('Some sources could not be read. Cached rows may be outdated; actions needing an unavailable source are hidden.'):'';
  this.warning.hidden=!this.warning.textContent;
  const pages=Math.max(1,Math.ceil(rows.length/50));this.page=Math.min(this.page,pages-1);this.body.replaceChildren();
  const visible=rows.slice(this.page*50,this.page*50+50);this.visibleMACs=visible.flatMap(r=>r.macs);
  for(const row of visible){
   const addressNodes=row.ipv4.concat(row.ipv6).map(ip=>E('span',{},ip+(row.reservations.some(r=>r.ip===ip)?' · '+_('reserved'):'')));
   const currentLeases=row.leases.map(l=>E('span',{},'IPv'+l.family+': '+elapsed(devices.remaining(l,Date.now()))));
   const source=row.sources.filter(s=>!['neighbour','fdb','wifi','saved'].includes(s));
   const identity=[E('strong',{},row.name||_('Unnamed device'))];
   if(row.name!==row.reportedName&&row.reportedName)identity.push(E('small',{},_('Reported')+': '+row.reportedName));
   row.macs.forEach(m=>identity.push(this.macIdentity(m)));
   if(!row.macs.length)row.duids.forEach(d=>identity.push(E('small',{title:d},'DUID '+d)));
   if(row.aliases.length&&!source.length&&!row.neighbours.length&&!row.forwards.length&&!row.wireless.length)identity.push(E('small',{},_('Saved name · not observed')));
   this.body.append(E('tr',{},[
    E('td',{'data-label':_('Device')},identity),E('td',{'data-label':_('Addresses')},addressNodes.length?addressNodes:'—'),
    E('td',{'data-label':_('Connection')},this.connection(row,snapshot)),E('td',{'data-label':_('Assignment')},source.map(s=>sourceNames[s]).join(' · ')||'—'),
    E('td',{'data-label':_('Lease remaining')},currentLeases.length?currentLeases:'—'),E('td',{'data-label':_('Actions')},this.rowActions(row,pools))]));
  }
  if(!rows.length)this.body.append(E('tr',{},E('td',{colspan:6},Object.keys(this.state).length?_('No matching devices.'):Object.keys(this.failures).length?_('Device information unavailable.'):_('Collecting device information…'))));
  this.navigation.replaceChildren(E('span',{},rows.length?_('Showing')+' '+(this.page*50+1)+'–'+Math.min(rows.length,this.page*50+50)+' / '+rows.length:_('No rows')));
  if(pages>1)this.navigation.append(E('button',{type:'button','class':'btn',disabled:this.page===0?'disabled':null,click:()=>{this.page--;this.draw();}},_('Previous')),
   E('button',{type:'button','class':'btn',disabled:this.page===pages-1?'disabled':null,click:()=>{this.page++;this.draw();}},_('Next')));
  if(this.vendorResults.size>1024){const keep=new Set(this.visibleMACs);for(const key of this.vendorResults.keys()){if(this.vendorResults.size<=1024)break;if(!keep.has(key))this.vendorResults.delete(key);}}
  const info=this.vendorRegistry.info;
  this.vendorButton.hidden=this.vendorMode==='auto'&&!this.vendorError;
  this.vendorButton.disabled=!!this.vendorBusy||!this.visibleMACs.some(m=>vendors.classify(m)==='global');
  this.vendorButton.textContent=this.vendorError?_('Retry lookup'):_('Look up visible');
  this.vendorNotice.textContent=this.vendorBusy?_('Loading vendor database in this browser…'):
   this.vendorError?_('Vendor lookup unavailable. Check Internet access and retry; device details remain usable.'):
   info?(info.stale?_('Using a cached vendor database; its update was unavailable.'):_('Vendor database ready'))+' · '+new Date(info.at).toLocaleDateString():
   _('Vendor matching runs in this browser. Device MAC addresses stay local.');
  this.vendorNotice.title=_('Wireshark vendor-prefix database; cached in this browser for seven days. A registered prefix owner does not identify a device model.');
  const pending=this.visibleMACs.filter(mac=>vendors.classify(mac)==='global'&&!this.vendorResults.has(mac));
  if(this.vendorMode==='auto'&&pending.length&&!this.vendorBusy&&!this.vendorQueued&&!document.hidden&&!this.scheduler.paused&&!this.editing){
   this.vendorQueued=true;Promise.resolve().then(()=>{this.vendorQueued=false;if(this.vendorMode==='auto'&&!this.disposed&&!document.hidden&&!this.scheduler.paused)this.lookupVendors(pending);});
  }
 },
 async editor(title,description,data,fields,stage,remove) {
  if(!this.writable||this.editing)return;
  this.editing=true;const wasPaused=this.scheduler.paused;this.scheduler.pause(true);
  const finish=()=>{this.editing=false;ui.hideModal();if(!wasPaused)this.scheduler.pause(false);};
  const map=new form.JSONMap({entry:data}),section=map.section(form.NamedSection,'entry','entry');
  for(const field of fields){const option=section.option(form.Value,field.key,field.title);Object.assign(option,field.options);}
  const error=E('p',{'class':'zc-devices-warning','role':'alert'}),buttons=[];
  let attempted=false,saving=false;
  const cancel=E('button',{type:'button','class':'btn',click:finish},_('Cancel'));
  const submit=async removing=>{
   if(saving||attempted)return;saving=true;buttons.forEach(b=>b.disabled=true);error.textContent='';
   try{
    if(!removing)await map.save(null,true);
    const values=Object.fromEntries(fields.map(f=>[f.key,map.data.get('json','entry',f.key)]));
    await (removing?remove:stage)(values,()=>{attempted=true;});
    await ui.changes.init();finish();Promise.resolve(ui.changes.displayChanges()).catch(e=>ui.addNotification(null,E('p',{},e.message)));
   }catch(e){
    error.textContent=attempted?_('Could not confirm the saved change. Review pending changes before trying again.'):e.message;
    if(attempted)ui.changes.init().catch(()=>{});
   }finally{saving=false;buttons.forEach(b=>b.disabled=attempted&&b!==cancel);}
  };
  buttons.push(cancel);
  if(remove)buttons.push(E('button',{type:'button','class':'cbi-button cbi-button-negative',click:()=>submit(true)},_('Remove name for review')));
  buttons.push(E('button',{type:'button','class':'cbi-button cbi-button-positive',click:()=>submit(false)},_('Save for review')));
  try{ui.showModal(title,[E('p',{},description),await map.render(),error,E('div',{'class':'right'},buttons)]);}
  catch(e){finish();ui.addNotification(null,E('p',{},e.message));}
 },
 friendlyName(row,alias) {
  const cfg='zcop_devices',id=alias?.['.name'];
  const load=async()=>{
   const fresh=await config(cfg),current=id?devices.sections(fresh).find(s=>s['.name']===id):null;
   if(id&&(!current||JSON.stringify(current)!==JSON.stringify(alias)))throw Error(_('This saved name changed. Close this form and refresh the device list.'));
   if(!id&&devices.combine({aliases:fresh}).some(r=>r.macs.some(m=>row.macs.includes(m))||r.duidIds.some(d=>row.duidIds.includes(d))))
    throw Error(_('This device already has a saved name. Close this form and refresh the device list.'));
   uci.unload(cfg);await uci.load(cfg);
  };
  this.editor(alias?_('Edit friendly name'):_('Set friendly name'),_('A display label only; it does not change the client hostname or DHCP address. Save for review, then use LuCI Save & Apply when ready.'),
   {name:alias?.name||row.reportedName},[{key:'name',title:_('Friendly name'),options:{rmempty:false}}],async(values,attempt)=>{
    const invalid=devices.aliasError(values.name);if(invalid)throw Error(_(invalid));await load();
    const section=id||uci.add(cfg,'device');uci.set(cfg,section,'name',values.name.trim());
    if(!id){if(row.macs.length)uci.set(cfg,section,'mac',row.macs);else uci.set(cfg,section,'duid',row.duidIds);}
    attempt();await uci.save();
   },alias?async(_values,attempt)=>{await load();uci.remove(cfg,id);attempt();await uci.save();}:null);
 },
 reserve(row,ip,host) {
  const id=host?.['.name'];
  this.editor(host?_('Edit static lease'):_('Set static lease'),_('Reserve an IPv4 address in OpenWrt DHCP. Saving stages the change; use LuCI Save & Apply after reviewing pending changes.'),
   {name:host?.name||row.reportedName,mac:host?(Array.isArray(host.mac)?host.mac[0]:host.mac.split(/\s+/)[0]):row.macs[0],ip},[
    {key:'name',title:_('Hostname'),options:{datatype:'hostname',rmempty:true}},
    {key:'mac',title:_('MAC address'),options:{datatype:'macaddr',rmempty:false,readonly:!!host}},
    {key:'ip',title:_('IPv4 address'),options:{datatype:'ip4addr',rmempty:false}}
   ],async(values,attempt)=>{
    const [fresh,net,currentLeases]=await Promise.all([config('dhcp'),interfaces(),leases()]);
    if(host){const current=devices.sections(fresh).find(s=>s['.name']===id);if(!current||JSON.stringify(current)!==JSON.stringify(host))throw Error(_('This reservation changed. Close this form and refresh the device list.'));values.mac=Array.isArray(host.mac)?host.mac[0]:host.mac.split(/\s+/)[0];}
    const invalid=devices.reservationError(values,fresh,devices.pools(fresh,net),currentLeases,id);if(invalid)throw Error(_(invalid.message));
    uci.unload('dhcp');await uci.load('dhcp');
    const section=id||uci.add('dhcp','host');if(!id)uci.set('dhcp',section,'mac',[devices.mac(values.mac)]);uci.set('dhcp',section,'ip',values.ip.trim());
    if(values.name){uci.set('dhcp',section,'name',values.name);if(!id)uci.set('dhcp',section,'dns','1');}else if(id)uci.unset('dhcp',section,'name');
    attempt();await uci.save();
   });
 },
 handleSaveApply:null,handleSave:null,handleReset:null
});
