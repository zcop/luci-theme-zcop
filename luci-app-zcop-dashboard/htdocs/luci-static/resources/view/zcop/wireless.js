'use strict';
'require view';
'require rpc';
'require zcop.wireless as wireless';
/* SPDX-License-Identifier: Apache-2.0. Manual snapshots/scans, no configuration writes. */
const radios = rpc.declare({object:'luci-rpc',method:'getWirelessDevices',expect:{'':{}},reject:true});
const iw = method => rpc.declare({object:'iwinfo',method,params:['device'],expect:{'':{}},reject:true,nobatch:method==='scan'});
const info=iw('info'),survey=iw('survey'),stations=iw('assoclist'),scan=iw('scan');
const execute=rpc.declare({object:'file',method:'exec',params:['command','params'],expect:{'':{}},reject:true});
async function channels(phy) {
 if(!/^phy[0-9]{1,2}$/.test(phy||''))throw Error('PHY identity unavailable');
 const result=await execute('/usr/sbin/iw',['phy',phy,'channels']);
 if(result.code!==0)throw Error('Kernel channel listing unavailable');
 const rows=wireless.kernelChannels(result.stdout);
 if(!rows)throw Error('Kernel channel listing unavailable');
 return rows;
}
const colors=['#35867d','#c08038','#8a73b4','#428ec0','#b36971','#7c9246','#b181a4','#729391'];
const bandNames={'2g':'2.4 GHz','5g':'5 GHz','6g':'6 GHz'};
const stateNames={up:_('Active'),pending:_('Configuring'),empty:_('No networks'),down:_('Down'),disabled:_('Disabled'),unknown:_('Unknown')};
// Array children are text nodes in LuCI; a bare string is interpreted as HTML.
const el = (tag,attrs,children) => E(tag,attrs,Array.isArray(children)?children:[children]);
const settle = async fn => {try{return {value:await fn()};}catch(error){return {error:error.message};}};
function list(response) {return Array.isArray(response?.results)?response.results:null;}
function button(text,fn,primary) {return el('button',{type:'button','class':'cbi-button'+(primary?' cbi-button-action':''),click:fn},text);}
function signalText(value) {return value==null?'—':value+' dBm';}
function signalLabel(value) {return value>=-60?_('Strong'):value>=-70?_('Usable'):_('Weak');}
function cell(value,detail,attrs) {return el('td',attrs||{},[el('span',{},value),detail?el('small',{},detail):null]);}
function svg(tag,attrs,text) {const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const key in attrs)node.setAttribute(key,attrs[key]);if(text!=null)node.textContent=text;return node;}

return view.extend({
 render() {
  if(!document.getElementById('zcop-wireless-style'))document.head.append(el('link',{id:'zcop-wireless-style',rel:'stylesheet',href:L.resource('zcop/wireless.css')}));
  this.writable=L.hasViewPermission()===true;this.snapshots={};this.scans={};this.rows=[];this.widths={};this.disposed=false;
  this.root=el('div',{'class':'zc-wireless'});this.draw();this.refresh();
  window.addEventListener('pagehide',()=>{this.disposed=true;clearTimeout(this.expiry);},{once:true});
  return this.root;
 },
 async refresh() {
  if(this.busy||this.disposed||document.hidden)return;
  this.busy=true;this.draw();
  try {
   const data=await radios();
   if(!data||typeof data!=='object'||Array.isArray(data))throw Error(_('Invalid radio response'));
   const next=[];
   for(const name of Object.keys(data).sort().slice(0,8)) {
    if(this.disposed||document.hidden)return;
    const radio=data[name],nets=wireless.interfaces(radio),active=radio.up===true&&nets.length>0;
    const jobs=[active?settle(()=>info(nets[0].ifname)):Promise.resolve({}),settle(()=>channels(radio.iwinfo?.phy)),settle(()=>survey(name))];
    const ap=nets.filter(n=>['ap','ap-wds'].includes(n.config?.mode)).slice(0,16);
    for(const net of ap)jobs.push(settle(()=>stations(net.ifname)));
    const result=await Promise.all(jobs),prior=this.snapshots[name];
    const detail={info:result[0].value,survey:list(result[2].value),previousSurvey:prior?.survey,
     freqs:result[1].value||null,stations:{}};
    ap.forEach((net,index)=>detail.stations[net.ifname]=list(result[3+index].value));
    this.snapshots[name]=detail;next.push(wireless.radio(name,radio,detail));
   }
   if(this.disposed)return;
   this.rows=next;this.failed=null;this.updated=Date.now();
   if(!next.some(r=>r.name===this.selected))this.selected=next[0]?.name;
  }catch(error){this.failed=error.message||_('Wireless data unavailable');}
  finally{this.busy=false;if(!this.disposed)this.draw();}
 },
 async scanSelected() {
  const radio=this.rows.find(r=>r.name===this.selected);
  if(!radio||this.busy||this.disposed||document.hidden||!this.writable||this.failed)return;
  this.busy=true;this.scanning=radio.name;this.draw();
  try {
   const response=await scan(radio.name);
   if(this.disposed||document.hidden)return;
   const results=list(response);
   if(!results)throw Error(_('Invalid scan response'));
   const data=wireless.scan(results,radio.band,this.rows.flatMap(r=>r.own));
   this.scans[radio.name]=Object.assign(data,{time:Date.now(),failed:false});
   // Regulatory information is refreshed after each scan; a failed read disables suggestions.
   const f=await settle(()=>channels(radio.phy));radio.freqs=f.value||null;
  }catch(error){
   this.scans[radio.name]=Object.assign({},this.scans[radio.name],{failed:true,error:error.message||_('Scan failed')});
  }finally{this.busy=false;this.scanning=null;if(!this.disposed)this.draw();}
 },
 draw() {
  if(this.disposed)return;
  const opened=Array.from(this.root.querySelectorAll('details[open]')).map(d=>d.dataset.section);
  clearTimeout(this.expiry);
  const radio=this.rows.find(r=>r.name===this.selected),snapshot=radio&&this.scans[radio.name];
  const refresh=button(this.busy&&!this.scanning?_('Reading…'):_('Refresh status'),()=>this.refresh());refresh.disabled=!!this.busy;
  const toolbar=el('div',{'class':'zw-heading'},[el('div',{},[el('h2',{'class':'zw-sr'},_('Wireless')),
   el('p',{},_('Radio status and the wireless space around this router.'))]),refresh]);
  const headings=[_('Radio'),_('State'),_('Channel / width'),_('AP clients'),_('Signal'),_('Noise'),_('Busy airtime')];
  const table=el('div',{'class':'zw-table-wrap'},el('table',{'class':'zw-radios'},[
   el('thead',{},el('tr',{},headings.map(h=>el('th',{},h)))),el('tbody',{},this.rows.map(r=>{
    const signals=r.signals,signal=r.uplink??(signals.length?Math.min(...signals):null);
    return el('tr',{'class':r.name===this.selected?'zw-selected':''},[
     el('th',{scope:'row'},[el('strong',{},bandNames[r.band]||r.name),el('small',{},r.name)]),
     cell(stateNames[r.state],r.country||null),
     cell(r.channel?String(r.channel)+(r.width?' · '+r.width+' MHz':''):'—',r.channel?null:r.configured?(_('Configured')+' '+r.configured+(r.configuredWidth?' · '+r.configuredWidth+' MHz':'')):_('Not operating')),
     cell(r.count==null?'—':String(r.count)),
     cell(signalText(signal),signal==null?null:signalLabel(signal)+' · '+(r.uplink!=null?_('Uplink'):_('Weakest client'))),
     cell(signalText(r.noise)),cell(r.busy==null?'—':r.busy.toFixed(0)+'%',r.busy==null?null:r.interval?_('Since last read'):_('Since counter reset'))
    ]);
   }))]));
  const notice=this.failed?el('p',{'class':'zw-warning',role:'status'},_('Radio data unavailable. Last-read values may be stale. ')+this.failed):null;
  const selected=el('select',{'aria-label':_('Radio for channel scan'),change:event=>{this.selected=event.target.value;this.draw();}},this.rows.map(r=>el('option',{value:r.name},(bandNames[r.band]||r.name)+' · '+r.name)));
  selected.value=this.selected||'';selected.disabled=!!this.busy||!radio;
  const desired=radio?(this.widths[radio.name]|| (radio.band==='2g'?20:Math.min(radio.width||radio.configuredWidth||80,160))):20;
  const supported=radio?.band==='2g'?[20]:[20,40,80,160].filter(w=>w===20||radio?.htmodes.some(m=>wireless.width(m)===w));
  const width=el('select',{'aria-label':_('Suggested channel width'),change:event=>{this.widths[radio.name]=Number(event.target.value);this.draw();}},supported.map(w=>el('option',{value:String(w)},w+' MHz')));
  width.value=String(supported.includes(desired)?desired:20);width.disabled=!radio||!!this.busy;
  const scanButton=button(this.scanning?_('Scanning…'):_('Scan nearby networks'),()=>this.scanSelected(),true);
  scanButton.disabled=!this.writable||!radio||!!this.busy||!!this.failed||radio.disabled;
  const analysis=el('div',{'class':'zw-analysis'},[
   el('div',{'class':'zw-analysis-heading'},[el('h3',{},_('Channel overlap')),el('div',{'class':'zw-actions'},[selected,width,scanButton])]),
   el('p',{'class':'zw-note'},this.writable?_('Scan on demand. Wi-Fi traffic can pause briefly during a scan.'):_('Read-only access. Scanning requires write permission.'))
  ]);
  if(snapshot?.failed)analysis.append(el('p',{'class':'zw-warning',role:'status'},_('Scan failed. Previous observations, if any, are stale. ')+snapshot.error));
  const rows=snapshot?.rows||[],stale=snapshot&&(snapshot.failed||Date.now()-snapshot.time>=300000);
  if(snapshot?.rows?.length) {
   const chart=el('div',{'class':'zw-chart-column'},[this.graph(radio,rows),this.legend(rows)]);
   const ranked=wireless.rank(rows,wireless.candidates(radio.freqs,radio.band,Number(width.value)),radio.channel);
   const advisory=el('div',{'class':'zw-advisory'});
   if(stale||this.failed)advisory.append(el('strong',{},_('Scan again for a current suggestion.')));
   else if(!ranked.length)advisory.append(el('strong',{},_('No suggestion: permitted channel data is unavailable for this width.')));
   else {
    const best=ranked[0],same=radio.channel===best.channel&&radio.width===best.width;
    advisory.append(el('span',{'class':'zw-kicker'},_('Lowest estimated overlap')),el('strong',{},_('Channel')+' '+best.channel+' · '+best.width+' MHz'),
     el('span',{},same?_('Matches the current channel.'):best.overlapping+' '+_('overlapping networks in this scan.')),
     ...(best.dfs?[el('span',{},_('DFS / radar checks may be required.'))]:[]));
   }
   advisory.append(el('small',{},_('Signal-weighted overlap estimate, not a speed guarantee. Hidden transmitters and non-Wi-Fi interference are not measured.')));
   analysis.append(el('div',{'class':'zw-plot-row'},[chart,advisory]));
  } else analysis.append(el('div',{'class':'zw-empty'},[
   el('strong',{},snapshot?.rows?_('No usable networks returned'):_('See how nearby Wi-Fi overlaps')),
   el('span',{},snapshot?.rows?_('A quiet or unsupported scan is not proof of an interference-free channel.'):_('Choose a radio and scan to draw the channel graph and estimate a lower-overlap channel.'))
  ]));
  const stamp=snapshot?.time?_('Scan snapshot: ')+new Date(snapshot.time).toLocaleTimeString()+(stale?' · '+_('Stale'):''):null;
  const plan=radio?.band==='2g'?_('2.4 GHz: channels 1 / 6 / 11 at 20 MHz, where permitted.'):null;
  if(stamp||plan)analysis.append(el('p',{'class':'zw-caption'},[stamp,plan,snapshot?.truncated?_('Strongest 512 observations retained'):null,snapshot?.omitted?snapshot.omitted+' '+_('unusable observations omitted'):null].filter(Boolean).join(' · ')));
  if(radio)analysis.append(el('div',{'class':'zw-detail-row'},[...(snapshot?.rows?.length?[this.neighbours(snapshot.rows)]:[]),this.networks(radio)]));
  analysis.append(el('p',{'class':'zw-caption zw-explain'},_('Busy airtime includes your own traffic. RSSI labels are approximate. Channel changes stay in Network → Wireless; client/mesh links can follow their peer’s channel.')));
  this.root.replaceChildren(toolbar,...(notice?[notice]:[]),...(this.rows.length?[table]:[el('p',{'class':'zw-empty'},this.busy?_('Reading radios…'):this.failed?_('Wireless data unavailable'):_('No radios reported'))]),analysis,
   el('div',{'class':'zw-footer'},(this.updated?_('Last status read: ')+new Date(this.updated).toLocaleTimeString():'')+' · '+_('On-demand snapshots; no automatic scans')));
  this.root.querySelectorAll('details').forEach(d=>{d.open=opened.includes(d.dataset.section);});
  const expirations=Object.values(this.scans).filter(s=>s.time&&!s.failed&&s.time+300000>Date.now()).map(s=>s.time+300000-Date.now());
  if(expirations.length)this.expiry=setTimeout(()=>this.draw(),Math.min(...expirations)+50);
 },
 graph(radio,rows) {
  const shown=rows.slice(0,24),allSpans=rows.flatMap(r=>r.spans),freqs=(radio.freqs||[]).map(f=>f.mhz).filter(m=>wireless.band(m)===radio.band);
  const min=Math.min(...allSpans.map(s=>s[0]),...freqs.map(f=>f-10))-5,max=Math.max(...allSpans.map(s=>s[1]),...freqs.map(f=>f+10))+5;
  const left=48,right=1040,top=18,bottom=195,x=f=>left+(f-min)/(max-min)*(right-left),y=db=>top+(-30-Math.max(-100,Math.min(-30,db)))/70*(bottom-top);
  const plot=svg('svg',{viewBox:'0 0 1060 230',role:'img','aria-label':_('Nearby network signal strength and channel overlap. The table below provides exact observations.')});
  for(const value of [-30,-50,-70,-90]){plot.append(svg('line',{x1:left,x2:right,y1:y(value),y2:y(value),'class':'zw-grid'}),svg('text',{x:8,y:y(value)+4,'class':'zw-axis'},String(value)));}
  plot.append(svg('text',{x:8,y:12,'class':'zw-axis'},'dBm'));
  if(radio.channel&&radio.mhz){plot.append(svg('line',{x1:x(radio.mhz),x2:x(radio.mhz),y1:top,y2:bottom,'class':'zw-current'}),svg('text',{x:x(radio.mhz)+4,y:top+10,'class':'zw-axis'},_('Current')+' '+radio.channel));}
  shown.slice().reverse().forEach(row=>{const i=shown.indexOf(row);for(const span of row.spans){const inset=Math.min(5,(span[1]-span[0])/4),points=[[span[0],bottom],[span[0]+inset,y(row.signal)],[span[1]-inset,y(row.signal)],[span[1],bottom]].map(p=>x(p[0])+','+p[1]).join(' ');
   const shape=svg('polygon',{points,fill:colors[i%colors.length],'fill-opacity':'.12',stroke:colors[i%colors.length],'stroke-width':'1.6','vector-effect':'non-scaling-stroke'});
   shape.append(svg('title',{},(row.ssid||_('Hidden SSID'))+' · '+_('Channel')+' '+row.channel+' · '+(row.estimated?'~':'')+row.width+' MHz · '+row.signal+' dBm'));plot.append(shape);}});
  const ticks=(radio.freqs||[]).filter(f=>wireless.band(f.mhz)===radio.band).filter((f,i)=>radio.band==='2g'||i%2===0);
  for(const f of ticks)plot.append(svg('text',{x:x(f.mhz),y:bottom+22,'text-anchor':'middle','class':'zw-axis'},String(f.channel)));
  const wrapper=el('div',{'class':'zw-chart'},plot);wrapper.append(el('span',{'class':'zw-chart-note'},_('Channel')+' · '+_('strongest')+' '+shown.length+' / '+rows.length));return wrapper;
 },
 legend(rows) {return el('div',{'class':'zw-legend'},rows.slice(0,6).map((row,i)=>el('span',{title:(row.ssid||_('Hidden SSID'))+' · '+row.bssid},[
  el('i',{style:'background:'+colors[i%colors.length],'aria-hidden':'true'}),row.ssid||_('Hidden SSID')])));},
 neighbours(rows) {
  return el('details',{'class':'zw-details','data-section':'nearby'},[el('summary',{},_('Nearby networks')+' · '+rows.length),el('div',{'class':'zw-table-wrap'},el('table',{'class':'zw-neighbours'},[
   el('thead',{},el('tr',{},[_('Network'),_('Channel'),_('Width'),_('Signal')].map(h=>el('th',{},h)))),el('tbody',{},rows.slice(0,50).map(row=>el('tr',{},[
    cell(row.ssid||_('Hidden SSID'),row.bssid),cell(String(row.channel)),cell((row.estimated?'~':'')+row.width+' MHz'),cell(signalText(row.signal))
   ])))])),rows.length>50?el('p',{'class':'zw-caption'},_('Showing the strongest 50 observations.')):null]);
 },
 networks(radio) {
  return el('details',{'class':'zw-details','data-section':'local'},[el('summary',{},_('Local networks')+' · '+radio.nets.length),radio.nets.length?el('div',{'class':'zw-local-networks'},radio.nets.map(net=>el('div',{},[
   el('strong',{},net.iwinfo?.ssid||net.config?.ssid||net.ifname),el('span',{},String(net.config?.mode||_('Unknown'))+' · '+net.ifname)
  ]))):el('p',{'class':'zw-caption'},_('No active network interfaces. Configured channel values do not describe an operating radio.'))]);
 },
 handleSaveApply:null,handleSave:null,handleReset:null
});
