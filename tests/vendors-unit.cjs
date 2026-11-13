/* SPDX-License-Identifier: Apache-2.0 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const model=new Function('baseclass',fs.readFileSync(path.join(__dirname,'../luci-app-zcop-dashboard/htdocs/luci-static/resources/zcop/vendors.js'),'utf8'))({extend:o=>o});
const sample='# Public fixture\n00:11:22\tExample\tExample Corporation\n00:11:22:30/28\tSmaller\tSmaller Assignment\n00:11:22:33:40/36\tSmallest\tSmallest <img src=x>\n88:99:AA\tOther\tOther Corporation\n';
const index=model.parse(sample);assert.equal(index.count,4);
assert.equal(model.classify('00:11:22:33:44:55'),'global');assert.equal(model.classify('02:11:22:33:44:55'),'private');
for(const bad of ['ff:ff:ff:ff:ff:ff','01:00:5e:00:00:01','00:00:00:00:00:00','invalid','001122334455'])assert.equal(model.classify(bad),'invalid');
assert.equal(model.find(index,'00:11:22:33:44:55').bits,36);assert.equal(model.find(index,'00:11:22:35:44:55').bits,28);assert.equal(model.find(index,'00:11:22:AA:BB:CC').bits,24);assert.equal(model.find(index,'00:00:11:22:33:44').state,'unknown');assert.equal(model.find(index,'02:11:22:33:44:55').state,'private');
assert.throws(()=>model.parse('<html>Bad response</html>'));assert.throws(()=>model.parse('x'.repeat(8388609)));
assert.throws(()=>model.parse('00:11:22:33:41/36\tNotCanonical\tInvalid prefix\n'));
function memoryDB(){const records=new Map();return {records,open(){const request={};queueMicrotask(()=>{const db={objectStoreNames:{contains:()=>true},close(){},transaction(){const tx={objectStore(){return{get(key){const r={};queueMicrotask(()=>{r.result=records.get(key);r.onsuccess?.();});return r;},put(value,key){records.set(key,structuredClone(value));queueMicrotask(()=>tx.oncomplete?.());}};}};return tx;}};request.result=db;request.onsuccess?.();});return request;}};}
(async()=>{const db=memoryDB(),compressed=zlib.gzipSync(sample);let now=10000000000,downloads=0,offline=false;
const environment={Blob,TextDecoder,DecompressionStream,AbortController,setTimeout,clearTimeout,indexedDB:db,Date:{now:()=>now},fetch:async(url,options)=>{downloads++;assert.equal(url,model.source+'.gz');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.mode,'cors');assert.ok(!url.includes('00:11:22'));if(offline)throw Error('offline');return new Response(compressed,{headers:{'content-length':String(compressed.length)}});}};
const first=model.create(environment);await Promise.all([first.load(),first.load(),first.load()]);assert.equal(downloads,1);assert.equal(first.find('00:11:22:33:44:55').name,'Smallest <img src=x>');assert.equal(db.records.size,1);
now+=86400000;const cached=model.create(environment);await cached.load();assert.equal(downloads,1,'fresh browser cache downloaded again');assert.equal(cached.info.cached,true);assert.equal(cached.info.stale,false);
now+=7*86400000;offline=true;const stale=model.create(environment);await stale.load();assert.equal(downloads,2);assert.equal(stale.info.stale,true);assert.equal(stale.find('88:99:aa:bb:cc:dd').state,'found');
const noCache=model.create({...environment,indexedDB:null});await assert.rejects(()=>noCache.load());
const stopped=model.create(environment);stopped.stop();await assert.rejects(()=>stopped.load(),/cancelled/);
const huge=model.create({...environment,indexedDB:null,fetch:async()=>new Response('',{headers:{'content-length':'9000000'}})});await assert.rejects(()=>huge.load(),/too large/);
assert.deepEqual(Object.keys(db.records.get('wireshark-manuf-v1')).sort(),['at','data','encoding'],'browser cache contains more than public database bytes and metadata');
console.log('PASS: longest 24/28/36-bit matching, private/invalid/unknown MACs, input bounds, serialized download, seven-day browser cache, offline stale fallback, cancellation and address-free fixed download URL');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
