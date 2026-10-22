import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../functions/mox-http-resolver/resolver.mjs',import.meta.url),'utf8')).replace("'npm:parse5@7.3.0'",JSON.stringify(import.meta.resolve('parse5')));
const {extractDocument,mediaIdentity,obtainMedia,reacquireMedia,probeMedia}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const page='https://redecanais.by/example_123456789.html';
const player='https://redecanais.by/player3/server.php?categoria=vod&server=RCFServer2&subfolder=ondemand&vid=FILM42';
const media='https://redecanais.by/RC/proxy?src='+encodeURIComponent('https://cdn.invalid/FILM42.mp4?signature=keep%2Bthis%3D');
const content=new Uint8Array(1024);content.set(new TextEncoder().encode('ftyp'),4);content[100]=42;
function fixture({block=false,gate=false,ad=false,changed=false}={}){
 let acquisitions=0;const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,range:options.headers.Range});
  if(block)return new Response('<title>Forbidden</title>',{status:403,headers:{'content-type':'text/html'}});
  if(url===page){acquisitions++;return new Response(gate?'<title>Just a moment</title><iframe src="/player3/server.php?vid=x"></iframe>':`<iframe src="${player.replaceAll('&','&amp;')}"></iframe>`,{headers:{'content-type':'text/html'}});}
  if(url===player)return new Response(`<video><source src="${ad?'https://redecanais.by/ad.mp4':media.replaceAll('&','&amp;')}"></video>`,{headers:{'content-type':'text/html'}});
  if(url===media){const bytes=content.slice();if(changed&&acquisitions>1)bytes[100]=99;return new Response(bytes,{status:206,headers:{'content-type':'video/mp4','content-range':'bytes 0-1023/1024'}});}
  throw Error('Unexpected request');
 };
 return {fetcher,calls};
}
test('associates only the exact content ID without rewriting a signed URL',()=>{
 assert.equal(mediaIdentity(media,'FILM42'),true);assert.equal(mediaIdentity(media,'FILM43'),false);
 const data=extractDocument(`<video data-content-id="FILM42"><source src="${media}"></video>`,page);assert.equal(data.media[0],media);
});
test('obtains a fresh media candidate and validates both MP4 byte ranges over HTTP',async()=>{
 const {fetcher,calls}=fixture();const result=await obtainMedia(page,fetcher);
 assert.equal(result.media_url,media);assert.equal(result.http_range_validated,true);assert.equal(result.playback_validated,false);assert.equal(result.client_portability_validated,false);assert.equal(calls.filter(c=>c.range).length,2);
});
test('reacquires matching bytes but does not claim expiry or automatic renewal validation',async()=>{
 const {fetcher}=fixture();const result=await reacquireMedia(page,fetcher);assert.equal(result.reacquisition_validated,true);assert.equal(result.renewal_after_expiry_validated,false);
});
test('rejects a renewal that changes content',async()=>{
 await assert.rejects(()=>reacquireMedia(page,fixture({changed:true}).fetcher),e=>e.code==='renewal_content_changed');
});
test('stops at HTTP 403 with no retry, player execution or alternate domain',async()=>{
 const {fetcher,calls}=fixture({block:true});await assert.rejects(()=>obtainMedia(page,fetcher),e=>e.code==='source_access_refused'&&e.details.upstream_status===403);assert.equal(calls.length,1);
});
test('does not deliver ads or unrelated media',async()=>{await assert.rejects(()=>obtainMedia(page,fixture({ad:true}).fetcher),e=>e.code==='content_unconfirmed');});
test('does not execute scripts and does not bypass a gate',async()=>{
 const {fetcher,calls}=fixture({gate:true});await assert.rejects(()=>obtainMedia(page,fetcher),e=>e.code==='source_access_required');assert.equal(calls.length,1);
 const result=extractDocument(`<script>fetch('${media}')</script>`,page);assert.equal(result.media.length,0);
});
test('rejects external/private-network media without issuing a request',async()=>{
 let calls=0;await assert.rejects(()=>probeMedia('http://127.0.0.1/file.mp4','https://redecanais.by',async()=>{calls++;}),e=>e.code==='source_outside_scope');assert.equal(calls,0);
});
test('rejects HTML and invalid Range responses masquerading as video',async()=>{
 await assert.rejects(()=>probeMedia(media,'https://redecanais.by',async()=>new Response('<html/>',{headers:{'content-type':'text/html'}})),e=>e.code==='invalid_media_response');
});
