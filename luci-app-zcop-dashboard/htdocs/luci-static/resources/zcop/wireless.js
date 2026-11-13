'use strict';
'require baseclass';
/* SPDX-License-Identifier: Apache-2.0. Pure snapshot interpretation and scan-only estimates. */
const finite = Number.isFinite;
function dbm(value) {
 if (!finite(value)) return null;
 if (value > 2147483647 && value <= 4294967295) value -= 4294967296;
 return value < 0 && value >= -127 ? value : null;
}
function band(mhz) { return mhz >= 2400 && mhz < 2500 ? '2g' : mhz >= 4900 && mhz < 5925 ? '5g' : mhz >= 5925 && mhz < 7125 ? '6g' : null; }
function frequency(channel, which) {
 return which === '2g' ? (channel === 14 ? 2484 : 2407 + channel * 5)
  : which === '5g' ? 5000 + channel * 5 : which === '6g' ? (channel === 2 ? 5935 : 5950 + channel * 5) : null;
}
function width(mode) { const match = String(mode || '').match(/(?:HT|HE|EHT|VHT)(20|40|80|160|320)(?:[+-])?$/); return match ? Number(match[1]) : null; }
function spans(row, which) {
 const primary = row.mhz || frequency(row.channel, which);
 if (!finite(primary)) return [];
 for (const key of ['eht_operation', 'he_operation', 'vht_operation']) {
  const op = row[key];
  if (!op || ![20,40,80,160,320].includes(op.channel_width) || !op.center_freq_1) continue;
  let w = op.channel_width, c1 = op.center_freq_1, c2 = op.center_freq_2;
  // VHT's revised signalling can encode 160 or 80+80 as width 80 and two centers.
  if (c2 && w === 80 && Math.abs(c1-c2) === 8) { w = 160; c1 = c2; c2 = 0; }
  const f1 = frequency(c1, which);
  if (band(f1)!==which || c2 && band(frequency(c2,which))!==which || which==='2g'&&w>40 || which==='5g'&&w>160) continue;
  if (c2 && w === 80) return [[f1-40,f1+40],[frequency(c2,which)-40,frequency(c2,which)+40]];
  return [[f1-w/2,f1+w/2]];
 }
 const ht = row.ht_operation;
 if (ht?.channel_width === 40 && /^(above|below)$/.test(ht.secondary_channel_offset)) {
  const center = primary + (ht.secondary_channel_offset === 'above' ? 10 : -10);
  return [[center-20,center+20]];
 }
 // A conservative 22 MHz footprint for a 2.4 GHz beacon with no wide operation.
 const half = which === '2g' ? 11 : 10;
 return [[primary-half,primary+half]];
}
function scan(results, which, own) {
 if (!Array.isArray(results)) throw new Error('Invalid scan response');
 const local = new Set((own || []).map(s => String(s).toLowerCase())), entries = new Map();
 let omitted = 0;
 for (const item of results) {
  if (!item || !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(item.bssid || '')) { omitted++; continue; }
  const id = item.bssid.toLowerCase(), mhz = item.mhz || frequency(item.channel, which), signal = dbm(item.signal);
  if (local.has(id)) continue;
  if (band(mhz) !== which || signal === null || !Number.isInteger(item.channel) || item.channel <= 0) { omitted++; continue; }
  const row = {ssid: String(item.ssid || ''), bssid: id, channel:item.channel, mhz, signal, spans:spans(item,which)};
  row.width = row.spans.reduce((n,s) => n+s[1]-s[0],0);
  row.estimated = which==='2g'&&row.width===22 || !item.ht_operation&&!item.vht_operation&&!item.he_operation&&!item.eht_operation;
  if(which==='2g'&&row.width===22)row.width=20;
  if (!entries.has(id) || entries.get(id).signal < signal) entries.set(id,row);
 }
 const rows = Array.from(entries.values()).sort((a,b) => b.signal-a.signal || a.bssid.localeCompare(b.bssid));
 return { rows: rows.slice(0,512), omitted, truncated: rows.length > 512 };
}
// Parse the kernel channel listing, not libiwinfo's uninitialized frequency flags.
function kernelChannels(output) {
 if (typeof output !== 'string' || output.length>262144) return null;
 const rows=[];let row=null;
 for(const line of output.split('\n')) {
  const match=line.match(/^\s*\*\s+(\d+(?:\.\d+)?) MHz \[(\d+)\]\s*(.*)$/);
  if(match) {
   row={channel:Number(match[2]),mhz:Number(match[1]),restricted:/disabled|no IR|passive scan/i.test(match[3]),flags:[],widths:null,dfs:false};
   rows.push(row);if(rows.length>512)return null;continue;
  }
  if(!row)continue;
  if(/No IR|Passive scan|DFS state: unavailable/i.test(line))row.restricted=true;
  if(/Radar detection/.test(line))row.dfs=true;
  const widths=line.match(/^\s*Channel widths:\s*(.*)$/);
  if(widths)row.widths=widths[1].trim().split(/\s+/);
 }
 for(const r of rows) {
  if(!r.widths)r.restricted=true;
  for(const [token,flag]of [['20MHz','no_20mhz'],['HT40+','no_ht40+'],['HT40-','no_ht40-'],['VHT80','no_80mhz'],['VHT160','no_160mhz']])
   if(!r.widths?.includes(token))r.flags.push(flag);
 }
 return rows.length?rows:null;
}
function candidates(freqs, which, mhzWidth) {
 if (!Array.isArray(freqs)) return [];
 const rows = freqs.filter(f => f && Number.isInteger(f.channel) && finite(f.mhz) && band(f.mhz) === which
  && (f.restricted === false || f.restricted === 0) && !f.flags?.includes('no_ir') && !f.flags?.includes('no_20mhz'));
 if (which === '2g') return mhzWidth === 20 ? rows.filter(f => [1,6,11].includes(f.channel)).map(f => ({channel:f.channel,width:20,low:f.mhz-10,high:f.mhz+10,dfs:false})) : [];
 if (!['5g','6g'].includes(which) || ![20,40,80,160].includes(mhzWidth)) return [];
 let starts;
 if (mhzWidth === 20) starts = rows.map(f => f.channel);
 else if (which === '6g') starts = Array.from({length:Math.ceil(233/(mhzWidth/5))},(_,i)=>1+i*mhzWidth/5);
 else {
  const groups = mhzWidth === 40 ? [[36,64],[100,144],[149,177]] : mhzWidth === 80 ? [[36,64],[100,144],[149,177]] : [[36,64],[100,128],[149,177]];
  starts = groups.flatMap(([first,last])=>Array.from({length:Math.floor((last-first+4)/(mhzWidth/5))},(_,i)=>first+i*mhzWidth/5));
 }
 const map = new Map(rows.map(f=>[f.channel,f]));
 return starts.flatMap(start => {
  const block = Array.from({length:mhzWidth/20},(_,i)=>map.get(start+4*i));
  if (block.some(f=>!f || mhzWidth>=80 && (f.flags?.includes('no_80mhz') || f.flags?.includes('no_'+mhzWidth+'mhz')))) return [];
  if (mhzWidth>=40 && block.some((f,i)=>f.flags?.includes(i%2 ? 'no_ht40-' : 'no_ht40+'))) return [];
  const low = block[0].mhz-10, high = block[block.length-1].mhz+10;
  return [{channel:start,channels:block.map(f=>f.channel),width:mhzWidth,low,high,dfs:block.some(f=>f.dfs===true) || which==='5g' && low<5730 && high>5250}];
 });
}
function rank(rows, channels, current) {
 return channels.map(c => {
  let score=0, overlapping=0;
  for (const row of rows) {
   const overlap = row.spans.reduce((n,s)=>n+Math.max(0,Math.min(c.high,s[1])-Math.max(c.low,s[0])),0);
   if (!overlap) continue;
   overlapping++;
   score += Math.pow(10,(row.signal+100)/10) * Math.min(1,overlap/c.width);
  }
  return Object.assign({},c,{channel:c.channels?.includes(current)?current:c.channel,score,overlapping});
 }).sort((a,b)=> a.score-b.score || Number(a.dfs)-Number(b.dfs) || Number(b.channel===current)-Number(a.channel===current) || a.channel-b.channel);
}
function survey(rows, previous, mhz) {
 const row = Array.isArray(rows) ? rows.find(r=>r.mhz===mhz) : null;
 if (!row) return {noise:null,busy:null,interval:false};
 const old = Array.isArray(previous) ? previous.find(r=>r.mhz===mhz) : null;
 let active=row.active_time, busy=row.busy_time, interval=false;
 if (old && active > old.active_time && busy >= old.busy_time) { active-=old.active_time; busy-=old.busy_time; interval=true; }
 const valid = Number.isSafeInteger(active) && Number.isSafeInteger(busy) && active>0 && busy>=0 && busy<=active;
 return {noise:dbm(row.noise),busy:valid?busy/active*100:null,interval:valid&&interval};
}
function interfaces(radio) {
 return (Array.isArray(radio.interfaces)?radio.interfaces:[]).flatMap(iface=>{
  const items=[iface,...(Array.isArray(iface.vlans)?iface.vlans.map(v=>Object.assign({},iface,v,{config:Object.assign({},iface.config,v.config)})):[])];
  return items.filter(i=>i.ifname && !['1',1,true].includes(i.config?.disabled));
 });
}
function radio(name, data, details) {
 const nets=interfaces(data), reported=details.info || {}, source=nets.find(n=>n.iwinfo?.frequency)?.iwinfo || data.iwinfo || {};
 const active = data.up === true && !data.pending && nets.length>0;
 const mhz = active ? (reported.frequency || source.frequency) : null;
 const ap = nets.filter(n=>['ap','ap-wds'].includes(n.config?.mode)), peers=new Map();
 let count=0, unknown=false;
 for (const net of ap) {
  const list=details.stations?.[net.ifname];
  if (!Array.isArray(list)) {unknown=true;continue;}
  for (const entry of list) if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(entry.mac||'')) peers.set(entry.mac.toLowerCase(),entry);
 }
 count=unknown || !Array.isArray(data.interfaces)?null:peers.size;
 const signals=Array.from(peers.values()).map(p=>dbm(p.signal)).filter(v=>v!==null);
 const clientMode=nets.some(n=>['sta','sta-wds'].includes(n.config?.mode));
 const station=nets.find(n=>['sta','sta-wds'].includes(n.config?.mode));
 const uplink=clientMode?dbm(station?.iwinfo?.signal ?? (station?.ifname===nets[0]?.ifname?reported.signal:null)):null;
 const busy=survey(details.survey,details.previousSurvey,mhz);
 return {name,phy:data.iwinfo?.phy,band:data.config?.band || band(mhz),active,disabled:data.disabled===true || ['1',1,true].includes(data.config?.disabled),
  state:data.disabled===true||['1',1,true].includes(data.config?.disabled)?'disabled':data.pending===true?'pending':data.up===false?'down':data.up!==true||!Array.isArray(data.interfaces)?'unknown':!nets.length?'empty':'up',
  mhz,channel:active ? (reported.channel || source.channel || null) : null, configured:data.config?.channel || null,
  width:active?width(reported.htmode):null,configuredWidth:width(data.config?.htmode),country:reported.country || source.country || data.config?.country,
  count,signals,uplink,noise:busy.noise ?? dbm(source.noise),busy:busy.busy,interval:busy.interval,
  nets,own:nets.map(n=>n.iwinfo?.bssid).filter(Boolean),hardware:data.iwinfo?.hardware?.name || '',
  htmodes:data.iwinfo?.htmodes || [],freqs:details.freqs || null};
}
return baseclass.extend({dbm,band,frequency,width,spans,scan,kernelChannels,candidates,rank,survey,interfaces,radio});
