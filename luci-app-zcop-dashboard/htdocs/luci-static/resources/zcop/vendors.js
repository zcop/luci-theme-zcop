'use strict';
'require baseclass';
/* SPDX-License-Identifier: Apache-2.0. All MAC matching stays in the browser. */
const SOURCE='https://www.wireshark.org/download/automated/data/manuf';
const WEEK=7*86400000,MAX_RAW=8388608,MAX_GZIP=2097152;
function address(value) {
 const text=String(value||'').toUpperCase();
 if(!/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(text)||text==='00:00:00:00:00:00'||parseInt(text.slice(0,2),16)&1)return null;
 return text;
}
function classify(value) {
 const mac=address(value);
 return !mac?'invalid':parseInt(mac.slice(0,2),16)&2?'private':'global';
}
function parse(text) {
 if(typeof text!=='string'||text.length>MAX_RAW)throw Error('Invalid vendor database');
 const maps=new Map([[24,new Map()],[28,new Map()],[36,new Map()]]);let count=0;
 for(const line of text.split('\n')){
  if(!line||line[0]==='#')continue;
  const match=line.match(/^(\S+)\s+(\S+)\s+(.+)$/);if(!match)continue;
  const parts=match[1].split('/'),raw=parts[0].replace(/:/g,'').toUpperCase(),bits=parts[1]?Number(parts[1]):raw.length*4;
  if(![24,28,36].includes(bits)||!/^[0-9A-F]{6,12}$/.test(raw)||raw.length*4<bits||!/^[0]*$/.test(raw.slice(bits/4)))continue;
  const name=match[3].trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,300);
  if(!name)continue;
  maps.get(bits).set(raw.slice(0,bits/4),name);
  if(++count>150000)throw Error('Vendor database is too large');
 }
 if(!count)throw Error('Vendor database has no usable prefixes');
 return {maps,count};
}
function find(index,value) {
 const type=classify(value);if(type!=='global')return {state:type};
 const raw=address(value).replace(/:/g,'');
 for(const bits of [36,28,24]){
  const prefix=raw.slice(0,bits/4),name=index?.maps.get(bits)?.get(prefix);
  if(name)return {state:'found',name,prefix,bits};
 }
 return {state:'unknown'};
}
async function bytes(stream,limit) {
 const reader=stream.getReader(),chunks=[];let length=0;
 try{
  for(;;){const result=await reader.read();if(result.done)break;length+=result.value.byteLength;
   if(length>limit){await reader.cancel();throw Error('Vendor database is too large');}chunks.push(result.value);}
 }finally{reader.releaseLock();}
 const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;
}
async function decode(env,record) {
 if(!record?.data||!['gzip','text'].includes(record.encoding)||record.data.byteLength>(record.encoding==='gzip'?MAX_GZIP:MAX_RAW))throw Error('Invalid cached database');
 const stream=new env.Blob([record.data]).stream();
 const raw=await bytes(record.encoding==='gzip'?stream.pipeThrough(new env.DecompressionStream('gzip')):stream,MAX_RAW);
 return parse(new env.TextDecoder('utf-8',{fatal:true}).decode(raw));
}
function cache(env,write) {
 return new Promise(resolve=>{
  if(!env.indexedDB){resolve(null);return;}
  let db,finished=false;const timer=env.setTimeout(()=>done(null),1500);
  function done(value){if(finished)return;finished=true;env.clearTimeout(timer);db?.close();resolve(value);}
  try{
   const request=env.indexedDB.open('zcop-public-vendor-database',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('database'))request.result.createObjectStore('database');};
   request.onerror=()=>done(null);request.onblocked=()=>done(null);
   request.onsuccess=()=>{
    db=request.result;if(finished){db.close();return;}
    try{
     const tx=db.transaction('database',write?'readwrite':'readonly'),store=tx.objectStore('database');
     if(write){store.put(write,'wireshark-manuf-v1');tx.oncomplete=()=>done(true);}
     else {const value=store.get('wireshark-manuf-v1');value.onsuccess=()=>done(value.result||null);}
     tx.onerror=()=>done(null);tx.onabort=()=>done(null);
    }catch(_){done(null);}
   };
  }catch(_){done(null);}
 });
}
class Registry {
 constructor(environment){this.env=environment||window;this.index=null;this.pending=null;this.stopped=false;this.info=null;}
 async load(){
  if(this.stopped)throw Error('Lookup cancelled');
  if(this.index)return this.index;
  if(this.pending)return this.pending;
  this.pending=this.collect().finally(()=>{this.pending=null;});return this.pending;
 }
 async collect(){
  const env=this.env,now=()=>env.Date.now();let saved=null,cached=null;
  try{saved=await cache(env);if(saved&&Number.isFinite(saved.at)&&saved.at<=now()+300000){cached=await decode(env,saved);
   if(now()-saved.at<WEEK){this.index=cached;this.info={at:saved.at,cached:true,stale:false};return cached;}}}catch(_){saved=null;cached=null;}
  if(this.stopped)throw Error('Lookup cancelled');
  this.controller=new env.AbortController();const timeout=env.setTimeout(()=>this.controller?.abort(),20000);
  try{
   const compressed=typeof env.DecompressionStream==='function',url=SOURCE+(compressed?'.gz':'');
   const response=await env.fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'default',signal:this.controller.signal});
   if(!response.ok)throw Error('Vendor database download failed');
   const limit=compressed?MAX_GZIP:MAX_RAW;
   if(Number(response.headers.get('content-length'))>limit)throw Error('Vendor database is too large');
   const data=response.body?await bytes(response.body,limit):new Uint8Array(await response.arrayBuffer());
   if(data.byteLength>limit)throw Error('Vendor database is too large');
   const record={at:now(),encoding:compressed?'gzip':'text',data:data.buffer},index=await decode(env,record);
   if(this.stopped)throw Error('Lookup cancelled');
   this.index=index;this.info={at:record.at,cached:false,stale:false};await cache(env,record);return index;
  }catch(error){
   if(cached&&!this.stopped){this.index=cached;this.info={at:saved.at,cached:true,stale:true};return cached;}
   throw error;
  }finally{env.clearTimeout(timeout);this.controller=null;}
 }
 find(mac){return find(this.index,mac);}
 stop(){this.stopped=true;this.controller?.abort();}
}
return baseclass.extend({address,classify,parse,find,source:SOURCE,create(environment){return new Registry(environment);}});
