import { beforeEach, expect, it, vi } from 'vitest';
import { catalogKey, type CatalogAction } from '../storage/catalog';
import { normalize } from '../detection/normalize';
let listener: (message: unknown,sender:unknown,reply:(response:unknown)=>void)=>unknown;
let disk:Record<string,unknown>;
beforeEach(async()=>{
 vi.resetModules(); disk={};
 vi.stubGlobal('chrome',{runtime:{onInstalled:{addListener:vi.fn()},getURL:(p:string)=>`chrome-extension://test/${p}`,onMessage:{addListener:(fn:typeof listener)=>{listener=fn;}}},tabs:{create:vi.fn().mockResolvedValue({})},storage:{local:{get:async(keys:string[])=>{await Promise.resolve();return Object.fromEntries(keys.map(k=>[k,disk[k]]));},set:async(values:Record<string,unknown>)=>{Object.assign(disk,values);}}}});
 await import('./index');
});
const make=(n:number)=>normalize(`Course ${n}`,`https://example.com/${n}`,[{title:'Chapter one',url:`https://example.com/${n}/one`}],'navigation');
const send=(action:CatalogAction)=>new Promise<{ok:boolean;error?:string}>(resolve=>listener({type:'LL_CATALOG',action},{},response=>resolve(response as {ok:boolean;error?:string})));
it('serializes concurrent metadata updates without losing other courses or progress',async()=>{
 disk['ll:v1:existing:chapter']=true;
 const replies=await Promise.all([send({type:'save',course:make(1)}),send({type:'complete',course:make(2)})]);
 expect(replies.every(r=>r.ok)).toBe(true);expect(Object.keys(disk[catalogKey] as object)).toHaveLength(2);expect(disk['ll:v1:existing:chapter']).toBe(true);
});
it('reports storage failures and continues processing subsequent requests',async()=>{
 chrome.storage.local.set=vi.fn().mockRejectedValueOnce(new Error('Write failed')).mockImplementation(async values=>{Object.assign(disk,values);});
 expect((await send({type:'save',course:make(1)})).ok).toBe(false);
 expect((await send({type:'save',course:make(2)})).ok).toBe(true);
});
