import { beforeEach, expect, it, vi } from 'vitest';
import { catalogKey, type CatalogAction } from '../storage/catalog';
import { normalize } from '../detection/normalize';
import { annotationKey, type Annotation } from '../storage/annotations';
import { progressKey } from '../storage/progress';
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
it('serializes simultaneous note and bookmark changes without losing either field',async()=>{
 const action={courseId:'course',chapterId:'chapter',courseTitle:'Course',title:'Topic',url:'https://example.com/topic'};
 const annotate=(patch:object)=>new Promise<{ok:boolean}>(resolve=>listener({type:'LL_ANNOTATION',action:{...action,...patch}},{},response=>resolve(response as {ok:boolean})));
 const replies=await Promise.all([annotate({note:'Review this example'}),annotate({bookmarked:true})]);
 expect(replies.every(r=>r.ok)).toBe(true);
 expect(disk[annotationKey('course','chapter')]).toMatchObject({note:'Review this example',bookmarked:true});
 chrome.storage.local.set=vi.fn().mockRejectedValueOnce(new Error('Disk full')).mockImplementation(async values=>Object.assign(disk,values));
 expect((await annotate({note:'Failed edit'})).ok).toBe(false);
 expect((disk[annotationKey('course','chapter')] as Annotation).note).toBe('Review this example');
 expect((await annotate({note:'Retry works'})).ok).toBe(true);
});
it('makes manually added children incomplete while restoring deleted flags on re-add',async()=>{
 const c=make(1);await send({type:'save',course:c});
 disk[progressKey(c.id,c.chapters[0].id)]=true;
 const edited=normalize(c.title,c.sourceUrl,[{title:'Chapter one',url:c.chapters[0].url},{title:'Section',url:c.chapters[0].url+'#section',parentUrl:c.chapters[0].url}],'navigation');
 expect((await send({type:'edit',course:edited})).ok).toBe(true);
 expect(disk[progressKey(c.id,edited.chapters[1].id)]).toBe(false);
 disk[progressKey(c.id,edited.chapters[1].id)]=true;
 await send({type:'edit',course:c});await send({type:'edit',course:edited});
 expect(disk[progressKey(c.id,edited.chapters[1].id)]).toBe(true);
});
it('retains inherited V2 progress when topics are reparented, removed, and restored',async()=>{
 const base='https://example.com/tutorial';
 const c=normalize('Tutorial',base,[{title:'Parent',url:base+'/one'},{title:'Inherited child',url:base+'/one#child',parentUrl:base+'/one'},{title:'Other chapter',url:base+'/two'}],'navigation');
 await send({type:'discover',course:c});disk[progressKey(c.id,c.chapters[0].id)]=true;
 const reparented={...c,chapters:c.chapters.map((ch,i)=>i===1?{...ch,parentId:c.chapters[2].id}:ch)};
 await send({type:'edit',course:reparented});
 expect(disk[progressKey(c.id,c.chapters[1].id)]).toBe(true);
 await send({type:'edit',course:{...reparented,chapters:reparented.chapters.filter(ch=>ch.id!==c.chapters[1].id)}});
 await send({type:'edit',course:reparented});
 expect(disk[progressKey(c.id,c.chapters[1].id)]).toBe(true);
});
