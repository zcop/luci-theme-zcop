/* SPDX-License-Identifier: Apache-2.0. Synthetic UI and UCI staging; no router. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'test-results');fs.mkdirSync(output,{recursive:true});
const bootstrap=process.env.LUCI_BOOTSTRAP_CSS;if(!bootstrap)throw Error('Set LUCI_BOOTSTRAP_CSS');
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/luci-static/zcop/cascade.css"></head><body class="zcop-theme" data-page="admin-status-zcop_devices"><div class="zcop-layout"><aside class="zcop-sidebar"><a class="zcop-brand">Synthetic UI fixture</a><nav id="topmenu"><a class="zcop-navitem active">Overview</a></nav></aside><main class="zcop-main"><div class="zcop-command"><nav id="tabmenu"><ul class="tabs zcop-page-tabs"><li><a>Dashboard</a></li><li class="active"><a>Devices</a></li></ul></nav><div id="indicators"></div></div><div class="zcop-content"><div id="view"></div><footer class="zcop-footer">Synthetic data · no router connection</footer></div></main></div></body></html>';
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
  const sources={};for(const [key,file]of Object.entries({model:'zcop/devices.js',scheduler:'zcop/scheduler.js',view:'view/zcop/devices.js'}))sources[key]=fs.readFileSync(path.join(root,'luci-app-zcop-dashboard/htdocs/luci-static/resources',file),'utf8');
  await page.evaluate(async sources=>{
   window._=s=>s;window.E=(tag,attrs,children)=>{
    const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs||{}))if(typeof value==='function')node.addEventListener(key,value);else if(value!=null)node.setAttribute(key,value);
    const append=v=>{if(Array.isArray(v))v.forEach(append);else if(v!=null)node.append(v instanceof Node?v:document.createTextNode(String(v)));};append(children);return node;
   };
   class Base{};Base.extend=properties=>{class Module extends Base{}Object.assign(Module.prototype,properties);return Module;};
   const instantiate=source=>new (new Function('baseclass',source)(Base))();
   window.devices=instantiate(sources.model);const Scheduler=instantiate(sources.scheduler);
   window.fixture={calls:[],writes:[],fail:[],readonly:false,hidden:false,review:0,config:{values:{lan:{'.name':'lan','.type':'dhcp',interface:'lan'},offline:{'.name':'offline','.type':'host',name:'Sleeping printer',mac:['02:00:00:00:00:02'],ip:'192.0.2.20'},unrelated:{'.type':'domain',name:'existing',ip:'192.0.2.80'}}},
    leases:{dhcp_leases:[{hostname:'Dual stack client',macaddr:'02:00:00:00:00:01',ipaddr:'192.0.2.10',expires:600},{hostname:'<img src=x onerror=alert(1)>',macaddr:'02:00:00:00:00:03',ipaddr:'192.0.2.11',expires:300}],dhcp6_leases:[{hostname:'Dual stack client',macaddr:'02:00:00:00:00:01',duid:'00010001abcd',iaid:'1',ip6addr:'2001:db8::10',expires:false}]},
    interfaces:[{interface:'lan',l3_device:'br-lan','ipv4-address':[{address:'192.0.2.1',mask:24}]}],
    neighbours4:'192.0.2.10 dev br-lan lladdr 02:00:00:00:00:01 STALE\n192.0.2.99 dev br-lan FAILED',
    neighbours6:'2001:db8::10 dev br-lan lladdr 02:00:00:00:00:01 REACHABLE'};
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixture.hidden});
   window.L={url:(...args)=>'/cgi-bin/luci/'+args.join('/'),resource:p=>'/luci-static/resources/'+p,hasViewPermission:()=>!fixture.readonly};
   const read=key=>{fixture.calls.push(key);if(fixture.fail.includes(key))return Promise.reject(Error('Fixture source unavailable'));if(key==='config'&&fixture.holdConfig)return new Promise(resolve=>fixture.releaseConfig=()=>{fixture.holdConfig=false;resolve(structuredClone(fixture.config));});return Promise.resolve(structuredClone(fixture[key]));};
   const rpc={declare:o=>o.object==='luci-rpc'?()=>read('leases'):o.object==='uci'?()=>read('config'):()=>read('interfaces')};
   const file={exec:(_cmd,args)=>read(args[0]==='-4'?'neighbours4':'neighbours6').then(stdout=>({code:0,stdout}))};
   let staged={};const uci={unload(){},load:async()=>{},add:()=>{fixture.writes.push('add');return 'new_static';},set:(_cfg,_id,key,value)=>{fixture.writes.push('set:'+key);staged[key]=value;},save:async()=>{fixture.writes.push('save');fixture.config.values.new_static={...staged,'.name':'new_static','.type':'host'};},apply:()=>{throw Error('Must never auto-apply');}};
   const ui={menu:{load:async()=>({children:{admin:{children:{network:{children:{dhcp:{satisfied:true}}}}}}})},changes:{init:async()=>{fixture.review++;},displayChanges:()=>{fixture.review++;}},
    hideModal:()=>{document.querySelector('#modal_overlay')?.remove();document.body.classList.remove('modal-overlay-active');},addNotification:()=>{},showModal:(title,children)=>{
     ui.hideModal();const overlay=E('div',{id:'modal_overlay',style:'display:block'},E('div',{'class':'modal',id:'fixture-modal'},[E('h3',{},title),children]));document.body.append(overlay);document.body.classList.add('modal-overlay-active');
    }};
   class JSONMap{
    constructor(data){this.values={...data.lease};this.options=[];this.data={get:(_cfg,_id,key)=>this.values[key]};}
    section(){return {option:(_type,key,title)=>{const option={key,title};this.options.push(option);return option;}};}
    async render(){this.element=E('div',{'class':'cbi-map'},this.options.map(o=>E('div',{'class':'cbi-value'},[E('label',{'class':'cbi-value-title',for:'fixture-'+o.key},o.title),E('div',{'class':'cbi-value-field'},E('input',{id:'fixture-'+o.key,value:this.values[o.key]||''}))])));return this.element;}
    async save(){for(const o of this.options){const value=this.element.querySelector('#fixture-'+o.key).value;if(!o.rmempty&&!value)throw Error('Required field');this.values[o.key]=value;}}
   }
   const form={JSONMap,NamedSection:{},Value:{}};
   window.deviceView=new (new Function('view','rpc','fs','uci','ui','form','devices','Scheduler',sources.view)(Base,rpc,file,uci,ui,form,devices,Scheduler))();
   document.querySelector('#view').append(deviceView.render());deviceView.scheduler.cancel();await deviceView.collect();
  },sources);
  await page.locator('.zc-devices-table').waitFor();
  assert.equal(await page.locator('.zc-devices-table tbody tr').count(),4);
  assert.equal(await page.locator('.zc-devices-table img').count(),0,'untrusted hostname interpreted as HTML');
  const dual=page.locator('tbody tr').filter({hasText:'Dual stack client'});
  assert.equal(await dual.count(),1);assert.match(await dual.innerText(),/2001:db8::10/);assert.match(await dual.innerText(),/Stale \(cached\)/);
  assert.match(await page.locator('tbody tr').filter({hasText:'Sleeping printer'}).innerText(),/Unknown/);
  await page.getByRole('searchbox').fill('192.0.2.99');assert.equal(await page.locator('tbody tr').count(),1);assert.match(await page.locator('tbody').innerText(),/Unreachable/);
  await page.getByRole('searchbox').fill('');await page.getByLabel('Device source',{exact:true}).selectOption('stale');assert.equal(await page.locator('tbody tr').count(),1);await page.getByLabel('Device source',{exact:true}).selectOption('');
  await dual.getByRole('button',{name:'Set static lease'}).click();
  assert.equal(await page.getByLabel('MAC address',{exact:true}).inputValue(),'02:00:00:00:00:01');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(await page.evaluate(()=>fixture.writes),[],'cancel staged configuration');
  await dual.getByRole('button',{name:'Set static lease'}).click();await page.getByLabel('IPv4 address',{exact:true}).fill('192.0.2.20');await page.getByRole('button',{name:'Save for review'}).click();
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
  assert.equal(await dual.getByRole('link',{name:'Manage'}).count(),1);
  await page.evaluate(()=>{deviceView.writable=false;deviceView.draw();});assert.equal(await page.getByRole('button',{name:'Set static lease'}).count(),0,'read-only action exposed');
  await page.evaluate(async()=>{deviceView.writable=true;fixture.fail=['config'];await deviceView.collect();});
  assert.match(await page.locator('.zc-devices-warning').first().textContent(),/outdated/);
  assert.ok(await page.getByRole('button',{name:'Set static lease'}).evaluateAll(buttons=>buttons.every(b=>b.disabled)));
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
  await page.evaluate(async()=>{deviceView.state={};deviceView.rows=[];fixture.fail=['leases','config','interfaces','neighbours4','neighbours6'];await deviceView.collect().catch(()=>{});});
  assert.equal(await page.locator('.zc-devices-count').textContent(),'Device data unavailable','source failure presented as zero devices');
  assert.deepEqual(errors,[]);
  console.log('PASS: Devices UI, identity merge, safe text, filtering/pagination, static modal cancel/validation/staging, read-only/errors, hidden polling and responsive layouts');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
