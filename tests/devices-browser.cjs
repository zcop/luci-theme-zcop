/* SPDX-License-Identifier: Apache-2.0. Synthetic UI and UCI staging; no router. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'test-results');fs.mkdirSync(output,{recursive:true});
const bootstrap=process.env.LUCI_BOOTSTRAP_CSS;if(!bootstrap)throw Error('Set LUCI_BOOTSTRAP_CSS');
const html='<!doctype html><html><head><style>.zc-device-actions:not([open])>ul.dropdown{display:none}</style><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/luci-static/zcop/cascade.css"></head><body class="zcop-theme" data-page="admin-status-zcop_devices"><div class="zcop-layout"><aside class="zcop-sidebar"><a class="zcop-brand">Synthetic UI fixture</a><nav id="topmenu"><a class="zcop-navitem active">Overview</a></nav></aside><main class="zcop-main"><div class="zcop-command"><nav id="tabmenu"><ul class="tabs zcop-page-tabs"><li><a>Dashboard</a></li><li class="active"><a>Devices</a></li></ul></nav><div id="indicators"></div></div><div class="zcop-content"><div id="view"></div><div class="zcop-page-footer zcop-footer"></div></div></main><footer class="zcop-branding-footer">Synthetic data · no router connection</footer></div></body></html>';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost').pathname;
 if(url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 let file=url==='/luci-static/bootstrap/cascade.css'?bootstrap:null;
 for(const pkg of ['luci-theme-zcop','luci-app-zcop-dashboard']){
  const base=path.join(root,pkg,'htdocs'),candidate=path.resolve(base,'.'+url);
  if(candidate.startsWith(base+path.sep)&&fs.existsSync(candidate))file=candidate;
 }
 if(!file){res.statusCode=404;res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1536,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('http://127.0.0.1:'+server.address().port);
  const sources={};for(const [key,file]of Object.entries({model:'zcop/devices.js',scheduler:'zcop/scheduler.js',view:'view/zcop/devices.js',vendors:'zcop/vendors.js'}))sources[key]=fs.readFileSync(path.join(root,'luci-app-zcop-dashboard/htdocs/luci-static/resources',file),'utf8');
  await page.evaluate(async sources=>{
   window._=s=>s;window.E=(tag,attrs,children)=>{
    const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs||{}))if(typeof value==='function')node.addEventListener(key,value);else if(value!=null)node.setAttribute(key,value);
    const append=v=>{if(Array.isArray(v))v.forEach(append);else if(v!=null)node.append(v instanceof Node?v:document.createTextNode(String(v)));};append(children);return node;
   };
   class Base{};Base.extend=properties=>{class Module extends Base{}Object.assign(Module.prototype,properties);return Module;};
   const instantiate=source=>new (new Function('baseclass',source)(Base))();
   window.devices=instantiate(sources.model);const Scheduler=instantiate(sources.scheduler),vendors=instantiate(sources.vendors);
   window.vendors=vendors;const originalCreate=vendors.create.bind(vendors);
   vendors.create=()=>originalCreate({Date,Blob,TextDecoder,DecompressionStream,AbortController,setTimeout,clearTimeout,indexedDB:null,fetch:async()=>{fixture.vendorDownloads++;if(fixture.vendorFail)throw Error('Offline');if(fixture.vendorHold)await new Promise(r=>fixture.vendorRelease=()=>{fixture.vendorHold=false;r();});return new Response(new Blob([fixture.vendorData]).stream().pipeThrough(new CompressionStream('gzip')),{status:200});}});
   window.fixture={vendorDownloads:0,vendorData:'00:11:22\tExample\tExample Devices Inc.\n00:11:22:30/28\tNarrow\tNarrow Assignment Inc.\n00:11:22:33:40/36\tSpecific\tSpecific <img src=x onerror=alert(1)>\n',aliases:{values:{}},wireless:{},fdb:'02:00:00:00:00:01 dev lan2 master br-lan\n02:00:00:00:00:01 dev lan2 vlan 3088 self',calls:[],writes:[],fail:[],readonly:false,hidden:false,review:0,config:{values:{lan:{'.name':'lan','.type':'dhcp',interface:'lan'},offline:{'.name':'offline','.type':'host',name:'Sleeping printer',mac:['02:00:00:00:00:02'],ip:'192.0.2.20'},unrelated:{'.type':'domain',name:'existing',ip:'192.0.2.80'}}},
    leases:{dhcp_leases:[{hostname:'Dual stack client',macaddr:'02:00:00:00:00:01',ipaddr:'192.0.2.10',expires:600},{hostname:'<img src=x onerror=alert(1)>',macaddr:'02:00:00:00:00:03',ipaddr:'192.0.2.11',expires:300}],dhcp6_leases:[{hostname:'Dual stack client',macaddr:'02:00:00:00:00:01',duid:'00010001abcd',iaid:'1',ip6addr:'2001:db8::10',expires:false}]},
    interfaces:[{interface:'lan',l3_device:'br-lan','ipv4-address':[{address:'192.0.2.1',mask:24}]}],
    neighbours4:'192.0.2.10 dev br-lan lladdr 02:00:00:00:00:01 STALE\n192.0.2.99 dev br-lan FAILED',
    neighbours6:'2001:db8::10 dev br-lan lladdr 02:00:00:00:00:01 REACHABLE'};
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixture.hidden});
   window.L={url:(...args)=>'/cgi-bin/luci/'+args.join('/'),resource:p=>'/luci-static/resources/'+p,hasViewPermission:()=>!fixture.readonly};
   const read=key=>{fixture.calls.push(key);if(fixture.fail.includes(key))return Promise.reject(Error('Fixture source unavailable'));if(key==='config'&&fixture.holdConfig)return new Promise(resolve=>fixture.releaseConfig=()=>{fixture.holdConfig=false;resolve(structuredClone(fixture.config));});return Promise.resolve(structuredClone(fixture[key]));};
   const rpc={declare:o=>o.object==='iwinfo'?()=>read('stations'):o.method==='getWirelessDevices'?()=>read('wireless'):o.object==='luci-rpc'?()=>read('leases'):o.object==='uci'?cfg=>read(cfg==='dhcp'?'config':'aliases'):()=>read('interfaces')};
   const file={exec:(cmd,args)=>read(cmd==='/usr/sbin/bridge'?'fdb':args[0]==='-4'?'neighbours4':'neighbours6').then(stdout=>({code:0,stdout}))};
   let staged={};const target=cfg=>cfg==='dhcp'?'config':'aliases';
   const uci={unload(){},load:async()=>{},add:(cfg,type)=>{fixture.writes.push('add');const id=cfg==='dhcp'?'new_static':'new_name';staged[cfg]||={};staged[cfg][id]={'.name':id,'.type':type};return id;},
    set:(cfg,id,key,value)=>{fixture.writes.push('set:'+key);staged[cfg]||={};staged[cfg][id]||=structuredClone(fixture[target(cfg)].values[id]);staged[cfg][id][key]=value;},
    unset:(cfg,id,key)=>{fixture.writes.push('unset:'+key);staged[cfg]||={};staged[cfg][id]||=structuredClone(fixture[target(cfg)].values[id]);delete staged[cfg][id][key];},
    remove:(cfg,id)=>{fixture.writes.push('remove:'+cfg);staged[cfg]||={};staged[cfg][id]=null;},
    save:async()=>{fixture.writes.push('save');for(const[cfg,entries]of Object.entries(staged))for(const[id,entry]of Object.entries(entries)){if(entry)fixture[target(cfg)].values[id]=entry;else delete fixture[target(cfg)].values[id];}staged={};},apply:()=>{throw Error('Must never auto-apply');}};
   class Dropdown{
    constructor(value,choices,options){this.choices=choices;this.options=options;}
    render(){this.node=E('div',{'class':'cbi-dropdown',tabindex:0},[E('ul',{'class':'preview'},E('li',{selected:''},this.options.select_placeholder)),E('ul',{'class':'dropdown'},Object.entries(this.choices).map(([value,label])=>E('li',{},E('button',{type:'button',click:event=>{event.stopPropagation();this.node.removeAttribute('open');this.node.dispatchEvent(new CustomEvent('cbi-dropdown-close'));this.node.dispatchEvent(new CustomEvent('cbi-dropdown-change',{detail:{value:{value,text:label}}}));}},label))))]);
     this.node.addEventListener('click',()=>{this.node.toggleAttribute('open');this.node.dispatchEvent(new CustomEvent(this.node.hasAttribute('open')?'cbi-dropdown-open':'cbi-dropdown-close'));});return this.node;}
    setValue(){this.node.dispatchEvent(new CustomEvent('cbi-dropdown-change',{detail:{value:null}}));}
   }

   const ui={Dropdown,menu:{load:async()=>({children:{admin:{children:{network:{children:{dhcp:{satisfied:true}}}}}}})},changes:{init:async()=>{fixture.review++;},displayChanges:()=>{fixture.review++;}},
    hideModal:()=>{document.querySelector('#modal_overlay')?.remove();document.body.classList.remove('modal-overlay-active');},addNotification:()=>{},showModal:(title,children)=>{
     ui.hideModal();const overlay=E('div',{id:'modal_overlay',style:'display:block'},E('div',{'class':'modal',id:'fixture-modal'},[E('h3',{},title),children]));document.body.append(overlay);document.body.classList.add('modal-overlay-active');
    }};
   class JSONMap{
    constructor(data){this.values={...data.entry};this.options=[];this.data={get:(_cfg,_id,key)=>this.values[key]};}
    section(){return {option:(_type,key,title)=>{const option={key,title};this.options.push(option);return option;}};}
    async render(){this.element=E('div',{'class':'cbi-map'},this.options.map(o=>E('div',{'class':'cbi-value'},[E('label',{'class':'cbi-value-title',for:'fixture-'+o.key},o.title),E('div',{'class':'cbi-value-field'},E('input',{id:'fixture-'+o.key,value:this.values[o.key]||'',readonly:o.readonly?'readonly':null}))])));return this.element;}
    async save(){for(const o of this.options){const value=this.element.querySelector('#fixture-'+o.key).value;if(!o.rmempty&&!value)throw Error('Required field');this.values[o.key]=value;}}
   }
   const form={JSONMap,NamedSection:{},Value:{}};
   window.deviceView=new (new Function('view','rpc','fs','uci','ui','form','devices','Scheduler','vendors',sources.view)(Base,rpc,file,uci,ui,form,devices,Scheduler,vendors))();
   document.querySelector('#view').append(deviceView.render());deviceView.scheduler.cancel();await deviceView.collect();
  },sources);
  const choose=async(row,label)=>{await row.locator('.zc-device-actions').click();await row.getByRole('button',{name:label,exact:true}).click();};
  await page.locator('.zc-devices-table').waitFor();
  assert.equal(await page.locator('.zc-devices-table tbody tr').count(),4);
  assert.equal(await page.locator('.zc-devices-table img').count(),0,'untrusted hostname interpreted as HTML');
  const dual=page.locator('tbody tr').filter({hasText:'Dual stack client'});
  assert.equal(await dual.count(),1);assert.match(await dual.innerText(),/2001:db8::10/);assert.match(await dual.innerText(),/Stale \(cached\)/);
  assert.match(await page.locator('tbody tr').filter({hasText:'Sleeping printer'}).innerText(),/unknown/);
  await page.getByRole('searchbox').fill('192.0.2.99');assert.equal(await page.locator('tbody tr').count(),1);assert.match(await page.locator('tbody').innerText(),/Unreachable/);
  await page.getByRole('searchbox').fill('');await page.getByLabel('Device source',{exact:true}).selectOption('stale');assert.equal(await page.locator('tbody tr').count(),1);await page.getByLabel('Device source',{exact:true}).selectOption('');
  await dual.locator('.zc-device-actions').click();const menuCalls=await page.evaluate(()=>fixture.calls.length);await page.evaluate(async()=>{await deviceView.collect();deviceView.draw();});assert.equal(await page.evaluate(()=>fixture.calls.length),menuCalls,'open action menu did not suspend refresh');assert.equal(await dual.locator('.zc-device-actions[open]').count(),1);await dual.locator('.zc-device-actions').evaluate(e=>{e.removeAttribute('open');e.dispatchEvent(new CustomEvent('cbi-dropdown-close'));});
  await choose(dual,'Set static lease');
  assert.equal(await page.getByLabel('MAC address',{exact:true}).inputValue(),'02:00:00:00:00:01');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(await page.evaluate(()=>fixture.writes),[],'cancel staged configuration');
  await choose(dual,'Set static lease');await page.getByLabel('IPv4 address',{exact:true}).fill('192.0.2.20');await page.getByRole('button',{name:'Save for review'}).click();
  assert.match(await page.locator('#fixture-modal [role=alert]').textContent(),/already reserved/);assert.deepEqual(await page.evaluate(()=>fixture.writes),[]);
  await page.evaluate(()=>fixture.holdConfig=true);
  await page.getByLabel('IPv4 address',{exact:true}).fill('192.0.2.10');await page.getByRole('button',{name:'Save for review'}).click();
  await page.waitForFunction(()=>!!fixture.releaseConfig);
  assert.equal(await page.getByRole('button',{name:'Cancel',exact:true}).isDisabled(),true,'cancel allowed while save was in progress');
  assert.deepEqual(await page.evaluate(()=>fixture.writes),[]);await page.evaluate(()=>fixture.releaseConfig());
  await page.waitForFunction(()=>fixture.writes.includes('save')&&fixture.review===2);
  assert.deepEqual(await page.evaluate(()=>fixture.config.values.new_static.mac),['02:00:00:00:00:01']);assert.equal(await page.evaluate(()=>fixture.config.values.unrelated.name),'existing','unrelated configuration changed');
  assert.ok(!await page.evaluate(()=>fixture.writes.some(w=>/apply|commit|delete/.test(w))));
  await page.evaluate(async()=>{deviceView.scheduler.cancel();await deviceView.collect();});
  assert.equal(await dual.getByRole('button',{name:'Edit static lease',exact:true,includeHidden:true}).count(),1);
  assert.match(await dual.innerText(),/Seen via LAN2/);assert.match(await dual.innerText(),/Downstream connection unknown/);assert.doesNotMatch(await dual.innerText(),/3088/,'private transport VID leaked into UI');
  const dhcpBefore=await page.evaluate(()=>JSON.stringify(fixture.config));
  await choose(dual,'Set friendly name');await page.getByLabel('Friendly name',{exact:true}).fill('x'.repeat(65));await page.getByRole('button',{name:'Save for review'}).click();assert.match(await page.locator('#fixture-modal [role=alert]').textContent(),/1–64/);
  await page.getByLabel('Friendly name',{exact:true}).fill('Living room TV');await page.getByRole('button',{name:'Save for review'}).click();await page.waitForFunction(()=>fixture.aliases.values.new_name?.name==='Living room TV');
  assert.equal(await page.evaluate(()=>JSON.stringify(fixture.config)),dhcpBefore,'display name altered DHCP configuration');
  await page.evaluate(async()=>{deviceView.scheduler.cancel();await deviceView.collect();});assert.match(await dual.innerText(),/Living room TV/);assert.match(await dual.innerText(),/Reported: Dual stack client/);
  await choose(dual,'Edit name');await page.getByRole('button',{name:'Remove name for review'}).click();await page.waitForFunction(()=>!fixture.aliases.values.new_name);await page.evaluate(async()=>{deviceView.scheduler.cancel();await deviceView.collect();});
  // Editing a reservation must retain alternative MACs and advanced DHCP options.
  await page.evaluate(async()=>{Object.assign(fixture.config.values.new_static,{mac:['02:00:00:00:00:01','02:00:00:00:00:04'],tag:['trusted'],duid:['00010001abcd%1'],hostid:'10',dns:'0'});await deviceView.collect();});
  await choose(dual,'Edit static lease');assert.equal(await page.getByLabel('MAC address',{exact:true}).getAttribute('readonly'),'readonly');await page.getByLabel('IPv4 address',{exact:true}).fill('192.0.2.12');await page.getByRole('button',{name:'Save for review'}).click();await page.waitForFunction(()=>fixture.config.values.new_static.ip==='192.0.2.12');
  assert.deepEqual(await page.evaluate(()=>[fixture.config.values.new_static.mac,fixture.config.values.new_static.tag,fixture.config.values.new_static.duid,fixture.config.values.new_static.hostid,fixture.config.values.new_static.dns]),[['02:00:00:00:00:01','02:00:00:00:00:04'],['trusted'],['00010001abcd%1'],'10','0']);
  await page.evaluate(async()=>{fixture.wireless={radio0:{up:true,interfaces:[{ifname:'phy0-ap0',config:{mode:'ap',ssid:'Room AP'},iwinfo:{frequency:5180}}]}};fixture.stations=[{mac:'02:00:00:00:00:01',signal:-55,rx:{rate:600000},tx:{rate:1201000}}];await deviceView.collect();});
  assert.match(await dual.innerText(),/Local Wi-Fi/);assert.match(await dual.innerText(),/Room AP/);assert.match(await dual.innerText(),/Tx 1201.0/);assert.match(await dual.innerText(),/Rx 600.0/);
  await page.evaluate(async()=>{fixture.fail=['stations'];await deviceView.collect();});assert.match(await dual.innerText(),/Local Wi-Fi · cached/);assert.doesNotMatch(await dual.innerText(),/Tx 1201.0/,'cached rate shown as current');
  await page.evaluate(async()=>{fixture.fail=[];fixture.stations=[];await deviceView.collect();});assert.doesNotMatch(await dual.innerText(),/Local Wi-Fi/,'empty association snapshot retained Wi-Fi badge');
  await page.evaluate(()=>{deviceView.writable=false;deviceView.draw();});assert.equal(await page.getByRole('button',{name:'Set static lease',includeHidden:true}).count(),0,'read-only action exposed');
  await page.evaluate(async()=>{deviceView.writable=true;fixture.fail=['config'];await deviceView.collect();});
  assert.match(await page.locator('.zc-devices-warning').first().textContent(),/outdated/);
  assert.equal(await page.getByRole('button',{name:'Set static lease',exact:true,includeHidden:true}).count(),0);
  // Manual and automatic vendor matching are browser-only; private MACs never load the database.
  await page.evaluate(async()=>{fixture.fail=[];await deviceView.collect();});
  assert.equal(await page.getByLabel('Vendor lookup mode').inputValue(),'manual');assert.equal(await page.evaluate(()=>fixture.vendorDownloads),0);
  assert.match(await dual.innerText(),/Private \/ locally administered/);assert.equal(await dual.locator('.zc-device-vendor-query').count(),0);
  await page.evaluate(async()=>{fixture.leases.dhcp_leases.push({macaddr:'00:11:22:33:44:55',hostname:'Vendor fixture',ipaddr:'192.0.2.66',expires:300});await deviceView.collect();fixture.vendorHold=true;});
  const vendorRow=page.locator('tbody tr').filter({hasText:'Vendor fixture'});assert.equal((await vendorRow.locator('.zc-device-mac').innerText()).trim(),'00:11:22:33:44:55');assert.equal(await vendorRow.locator('.zc-device-mac svg').count(),1);
  await vendorRow.getByRole('button',{name:'Look up vendor',exact:true}).click();await page.waitForFunction(()=>!!fixture.vendorRelease);assert.equal(await page.evaluate(()=>fixture.vendorDownloads),1);
  await page.evaluate(()=>deviceView.lookupVendors(['00:11:22:33:44:55']));assert.equal(await page.evaluate(()=>fixture.vendorDownloads),1,'concurrent lookup duplicated download');await page.evaluate(()=>fixture.vendorRelease());await page.waitForFunction(()=>!deviceView.vendorBusy);
  assert.match(await vendorRow.innerText(),/Specific <img/);assert.equal(await vendorRow.locator('img').count(),0,'vendor string became HTML');
  const macStyle=await vendorRow.locator('.zc-device-mac').evaluate(e=>({weight:getComputedStyle(e).fontWeight,size:parseFloat(getComputedStyle(e).fontSize)}));assert.ok(Number(macStyle.weight)>=600&&macStyle.size>=12,'MAC identity is not emphasized');
  await page.getByLabel('Vendor lookup mode').selectOption('auto');await page.evaluate(async()=>{fixture.leases.dhcp_leases.push({macaddr:'00:11:22:AA:BB:CC',hostname:'Automatic vendor fixture',ipaddr:'192.0.2.67',expires:300});await deviceView.collect();});await page.waitForFunction(()=>deviceView.vendorResults.get('00:11:22:aa:bb:cc')?.state==='found');assert.equal(await page.evaluate(()=>fixture.vendorDownloads),1,'automatic matching downloaded again');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zcop-vendor-lookup-mode')),'auto');
  await page.getByLabel('Vendor lookup mode').selectOption('manual');await page.evaluate(async()=>{fixture.leases.dhcp_leases.push({macaddr:'00:11:22:FE:DC:BA',hostname:'Manual vendor fixture',ipaddr:'192.0.2.68',expires:300});await deviceView.collect();});assert.equal(await page.locator('tbody tr').filter({hasText:'Manual vendor fixture'}).getByRole('button',{name:'Look up vendor',exact:true}).count(),1,'manual mode looked up new rows');
  await page.evaluate(()=>{deviceView.vendorRegistry.stop();deviceView.vendorRegistry=vendors.create();fixture.vendorFail=true;});await page.locator('tbody tr').filter({hasText:'Manual vendor fixture'}).getByRole('button',{name:'Look up vendor',exact:true}).click();await page.waitForFunction(()=>!deviceView.vendorBusy);assert.match(await page.locator('.zc-devices-vendor-notice').innerText(),/unavailable/);const downloads=await page.evaluate(()=>fixture.vendorDownloads);await page.evaluate(()=>{deviceView.draw();deviceView.draw();});assert.equal(await page.evaluate(()=>fixture.vendorDownloads),downloads,'failed lookup retried automatically');
  await page.evaluate(()=>fixture.vendorFail=false);await page.getByRole('button',{name:'Retry lookup',exact:true}).click();await page.waitForFunction(()=>!deviceView.vendorBusy);assert.match(await page.locator('tbody tr').filter({hasText:'Manual vendor fixture'}).innerText(),/Example Devices/);
  await page.getByRole('searchbox').fill('Example Devices');assert.equal(await page.locator('tbody tr').count(),2,'vendor search failed');await page.getByRole('searchbox').fill('');
  await page.evaluate(async()=>{
   fixture.fail=[];
   for(let i=0;i<80;i++)fixture.config.values['bulk'+i]={'.type':'host',name:'Device '+i,mac:['02:00:00:01:00:'+i.toString(16).padStart(2,'0')],ip:'192.0.2.'+(100+i)};
   await deviceView.collect();
  });
  assert.equal(await page.locator('tbody tr').count(),50);await page.getByRole('button',{name:'Next',exact:true}).click();assert.ok(await page.locator('tbody tr').count()<50);
  for(const width of [1536,768,390]){
   await page.setViewportSize({width,height:900});
   await page.locator('.zcop-content').evaluate(e=>e.scrollTo(0,0));
   if(width===390)assert.ok((await page.locator('tbody tr').first().boundingBox()).height<300,'mobile fields reserve unused grid rows');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'device list escaped frame');
   await page.screenshot({path:path.join(output,'devices-fixture-'+width+'.png')});
  }
  await page.evaluate(()=>{deviceView.scheduler.cancel();deviceView.scheduler.paused=false;deviceView.scheduler.visibility(true);});
  const calls=await page.evaluate(()=>fixture.calls.length);await page.clock.runFor(60000);assert.equal(await page.evaluate(()=>fixture.calls.length),calls,'hidden device page kept polling');
  await page.evaluate(async()=>{deviceView.state={};deviceView.rows=[];fixture.fail=['leases','config','aliases','interfaces','neighbours4','neighbours6','fdb','wireless'];await deviceView.collect().catch(()=>{});});
  assert.equal(await page.locator('.zc-devices-count').textContent(),'Device data unavailable','source failure presented as zero devices');
  assert.deepEqual(errors,[]);
  console.log('PASS: Devices UI, passive port/local-AP details, friendly-name staging/removal, reservation option preservation, stale sources, read-only access, hidden polling and responsive layouts');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
