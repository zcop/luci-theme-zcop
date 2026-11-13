/* SPDX-License-Identifier: Apache-2.0. Synthetic native-form DOM; no router. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),bootstrap=process.env.LUCI_BOOTSTRAP_CSS,output=path.join(root,'test-results');
if(!bootstrap)throw Error('Set LUCI_BOOTSTRAP_CSS');fs.mkdirSync(output,{recursive:true});
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/luci-static/zcop/cascade.css"></head><body class="zcop-theme" data-page="admin-system-system"><div class="zcop-layout"><aside class="zcop-sidebar"><a class="zcop-brand">Synthetic system fixture</a><nav id="topmenu">System</nav></aside><main class="zcop-main"><div class="zcop-command"><nav id="tabmenu">System</nav></div><div class="zcop-content"><div id="view"></div><div class="zcop-page-footer zcop-footer"></div></div></main><footer class="zcop-branding-footer">Synthetic data · no router</footer></div></body></html>';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost').pathname;if(url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 const base=path.join(root,'luci-theme-zcop/htdocs'),file=url==='/luci-static/bootstrap/cascade.css'?bootstrap:path.resolve(base,'.'+url);
 if(!(file===bootstrap||file.startsWith(base+path.sep))||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(code=>{
  window._=s=>s;window.E=(tag,attrs,children)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{}))if(v!=null)e.setAttribute(k,v);const append=v=>{if(Array.isArray(v))v.forEach(append);else if(v!=null)e.append(v instanceof Node?v:String(v));};append(children);return e;};
  window.L={resource:p=>'/luci-static/resources/'+p};window.events=0;
  const definitions={general:[['_systime','Local Time'],['hostname','Hostname'],['description','Description'],['notes','Notes'],['zonename','Timezone'],['clock_timestyle','Full TimeZone Name'],['clock_hourcycle','Time Format']],logging:[['log_size','System log buffer size'],['log_ip','External system log server'],['log_port','External system log server port'],['log_proto','External system log server protocol'],['log_file','Write system log to file'],['conloglevel','Log output level'],['cronloglevel','Cron Log Level']],timesync:[['enabled','Enable NTP client'],['enable_server','Provide NTP server'],['interface','Bind NTP server'],['use_dhcp','Use DHCP advertised servers'],['server','NTP server candidates']],language:[['_lang','Language'],['_mediaurlbase','Design'],['_tablefilters','Table Filters']]};
  window.renderNative=()=>{
   const map=document.querySelector('#cbi-system')||E('div',{id:'cbi-system','class':'cbi-map'});map.replaceChildren(E('h2',{},'System'),E('div',{'class':'cbi-map-descr'},'Redundant introductory text'));
   const section=E('div',{'class':'cbi-section'},E('h3',{},'System Properties')),tabs=E('ul',{'class':'cbi-tabmenu'}),group=E('div',{'class':'cbi-section-node cbi-section-node-tabbed','data-section-id':'fixture'});
   for(const[tab,fields]of Object.entries(definitions)){
    tabs.append(E('li',{'class':tab==='general'?'cbi-tab':'cbi-tab-disabled','data-tab':tab},E('a',{href:'#'},tab)));
    const pane=E('div',{id:'container.system.fixture.'+tab,'data-tab':tab,'data-tab-title':tab,'data-tab-active':String(tab==='general')});
    for(const[name,label]of fields){
     const id='widget.cbid.system.fixture.'+name,row=E('div',{'class':'cbi-value','data-name':name,'data-field':'cbid.system.fixture.'+name,'data-depends':name==='interface'?'[{"enable_server":"1"}]':'[]',id:'cbi-system-fixture-'+name}),field=E('div',{'class':'cbi-value-field'});
     if(name==='_systime'){
      field.append(E('input',{id:'localtime',readonly:'true',type:'text',value:'Synthetic local time'}),E('br'),E('span',{'class':'control-group'},[E('button',{'class':'cbi-button'},'Sync with browser'),E('button',{'class':'cbi-button'},'Sync with NTP-Server')]));
     }else if(name==='server'){
      field.append(E('div',{'class':'cbi-dynlist'},['one','two','three','four'].map(v=>E('div',{'class':'item'},v+'.example.test'))));
     }else if(name==='notes')field.append(E('textarea',{id},''));
     else if(['enabled','enable_server','use_dhcp','clock_timestyle','_tablefilters'].includes(name)){
      const input=E('input',{id,type:'checkbox'});input.checked=['enabled','use_dhcp'].includes(name);field.append(input);
     }else if(['zonename','clock_hourcycle','log_proto','conloglevel','cronloglevel','_lang','_mediaurlbase','interface'].includes(name))field.append(E('select',{id},E('option',{value:'fixture'},'Fixture value')));
     else field.append(E('input',{id,type:'text',value:name==='hostname'?'Fixture router':'',placeholder:'Optional'}));
     if(['description','notes','clock_timestyle','log_size','conloglevel','interface','server'].includes(name))field.append(E('div',{'class':'cbi-value-description'},name==='interface'?'Unspecified means all interfaces.':'Obvious '+name+' description'));
     row.append(E('label',{'class':'cbi-value-title',for:id},label),field);pane.append(row);
     row.addEventListener('change',()=>events++);
    }
    group.append(pane);
   }
   group.querySelector('[data-name=interface]').classList.add('hidden');
   section.append(tabs,group);map.append(section);if(!map.isConnected)document.querySelector('#view').append(map);
   document.querySelector('#view .cbi-page-actions')?.remove();const reset=E('button',{'class':'cbi-button cbi-button-reset'},'Reset');reset.addEventListener('click',renderNative);document.querySelector('#view').append(E('div',{'class':'cbi-page-actions'},[E('button',{'class':'cbi-button cbi-button-apply'},'Save & Apply'),E('button',{'class':'cbi-button cbi-button-save'},'Save'),reset]));
  };
  renderNative();window.nativeRows=[...document.querySelectorAll('[data-field]')];window.originalParents=nativeRows.map(e=>[e,e.closest('[data-tab-title]')]);
  window.layout=new Function('baseclass',code)({extend:o=>o});layout.__init__();
 },fs.readFileSync(path.join(root,'luci-theme-zcop/htdocs/luci-static/resources/zcop/system.js'),'utf8'));
 await page.locator('.zc-system-pane').first().waitFor();
 assert.equal(await page.evaluate(()=>nativeRows.every(e=>document.querySelector('[data-field="'+e.dataset.field+'"]')===e)),true,'native fields cloned or replaced');
 assert.equal(await page.evaluate(()=>originalParents.every(([e,p])=>e.closest('[data-tab-title]')===p)),true,'native tab ancestry changed');
 assert.equal(await page.locator('.zc-system-pane').count(),6);assert.equal(await page.locator('.cbi-tabmenu').isVisible(),false);
 for(const name of ['hostname','log_ip','enabled','_lang','server'])assert.equal(await page.locator('[data-name='+name+']').isVisible(),true,'native tab content omitted');
 assert.equal(await page.locator('[data-name=interface]').isVisible(),false,'hidden dependency forced visible');
 await page.getByLabel('Hostname',{exact:true}).fill('Edited in browser');await page.getByLabel('Hostname',{exact:true}).dispatchEvent('change');assert.equal(await page.evaluate(()=>events),1,'native event handler lost');
 await page.evaluate(()=>{const r=document.querySelector('[data-name=interface]');r.classList.remove('hidden');});assert.equal(await page.locator('[data-name=interface]').isVisible(),true);
 await page.evaluate(()=>{document.querySelectorAll('[data-tab=timesync] .cbi-value').forEach(e=>{if(e.dataset.name!=='enabled')e.classList.add('hidden');});});assert.equal(await page.locator('.zc-system-sources').isVisible(),false,'empty dependency group retained heading');
 await page.getByRole('button',{name:'Reset',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.zc-system-pane').length===6);
 assert.equal(await page.getByLabel('Hostname',{exact:true}).inputValue(),'Fixture router','reset did not rebuild native form');assert.equal(await page.locator('[data-name=interface]').isVisible(),false);
 const count=await page.locator('[data-field]').count();await page.evaluate(()=>{layout.decorate(document.querySelector('#view'));layout.decorate(document.querySelector('#view'));});assert.equal(await page.locator('[data-field]').count(),count);assert.equal(await page.locator('.zc-system-pane').count(),6,'decorator was not idempotent');
 for(const [width,height]of [[1920,1080],[1920,960],[1921,1080],[2560,1440],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await page.locator('.zcop-content').evaluate(e=>e.scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'System escaped shell');
  if(width>=1920){
   assert.equal(await page.locator('.zcop-content').evaluate(e=>e.scrollHeight>e.clientHeight),false,'default System needs scrolling at Full HD');
   const clock=await page.locator('.zc-system-clock').boundingBox(),appearance=await page.locator('.zc-system-interface').boundingBox();
   assert.ok(Math.abs(appearance.y-clock.y)<1&&Math.abs(appearance.y+appearance.height-clock.y-clock.height)<1,'Interface does not align with its top-row sections');
   const service=await page.locator('.zc-system-service').boundingBox(),sources=await page.locator('.zc-system-sources').boundingBox();
   assert.ok(Math.abs(sources.x-appearance.x)<.05&&Math.abs(service.x-clock.x)<.05,'Upper/lower column dividers do not align: '+JSON.stringify({width,clock:clock.x,service:service.x,appearance:appearance.x,sources:sources.x}));
  }
  await page.screenshot({path:path.join(output,'system-'+width+'.png')});
 }
 // New native fields/tabs must remain reachable after a LuCI update.
 await page.evaluate(()=>{const pane=E('div',{'data-tab':'future','data-tab-title':'Future','data-tab-active':'false'},E('div',{'class':'cbi-value','data-field':'future','data-name':'future'},E('input',{'aria-label':'Future setting'})));document.querySelector('.zc-system-root').append(pane);});assert.equal(await page.getByLabel('Future setting',{exact:true}).isVisible(),true);
 // Presentation must preserve native read-only state and page-exit cleanup.
 await page.evaluate(()=>document.querySelectorAll('#view input,#view select,#view textarea,#view button').forEach(e=>e.disabled=true));assert.equal(await page.getByLabel('Hostname',{exact:true}).isDisabled(),true);
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.evaluate(()=>renderNative());assert.equal(await page.locator('.zc-system-pane').count(),0,'observer kept decorating after page exit');
 assert.deepEqual(errors,[]);console.log('PASS: single-frame System layout, native node identity/events, tab ancestry, dependencies, reset/re-render, unknown fields, read-only state, Full HD fit and responsive containment');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
