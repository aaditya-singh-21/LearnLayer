import { beforeEach, expect, it, vi } from 'vitest';
import { loadProgress, setCompleted, setBranchCompleted, progressKey } from './progress';
import { normalize } from '../detection/normalize';
const disk: Record<string, unknown> = {};
beforeEach(() => { for (const k of Object.keys(disk)) delete disk[k]; vi.stubGlobal('chrome', { storage: { local: { get: async (keys: string[]) => Object.fromEntries(keys.map(k => [k,disk[k]])), set: async (values: Record<string,unknown>) => Object.assign(disk, values) } } }); });
const makeCourse = () => normalize('System Design','https://example.com/system-design',[{title:'One',url:'https://example.com/system-design/1'},{title:'Two',url:'https://example.com/system-design/2'},{title:'Three',url:'https://example.com/system-design/3'}],'navigation');
const nested=()=>normalize('Tutorial','https://example.com/tutorial',[{title:'Parent',url:'https://example.com/tutorial/one'},{title:'First',url:'https://example.com/tutorial/one#first',parentUrl:'https://example.com/tutorial/one'},{title:'Second',url:'https://example.com/tutorial/one#second',parentUrl:'https://example.com/tutorial/one'}],'navigation');
it('inherits legacy parent completion but explicit child flags override it and parents aggregate',async()=>{
 const c=nested();disk[progressKey(c.id,c.chapters[0].id)]=true;
 expect((await loadProgress(c)).chapters.every(c=>c.completed)).toBe(true);
 await setCompleted(c.id,c.chapters[1].id,false);
 const loaded=await loadProgress(c);expect(loaded.chapters.map(c=>c.completed)).toEqual([false,false,true]);
 await setCompleted(c.id,c.chapters[1].id,true);
 expect((await loadProgress(c)).chapters.every(c=>c.completed)).toBe(true);
});
it('completes and clears a branch without overwriting other courses or deleted chapter flags',async()=>{
 const c=nested();disk['ll:v1:other:retained']=true;
 await setBranchCompleted(c,c.chapters[0].id,true);
 expect((await loadProgress(c)).chapters.every(c=>c.completed)).toBe(true);
 await setBranchCompleted(c,c.chapters[0].id,false);
 expect((await loadProgress(c)).chapters.every(c=>!c.completed)).toBe(true);
 expect(disk['ll:v1:other:retained']).toBe(true);
});
it('restores progress into freshly detected courses and allows undo', async () => {
  const course = makeCourse(); await setCompleted(course.id,course.chapters[0].id,true);
  expect((await loadProgress(makeCourse())).chapters[0].completed).toBe(true);
  await setCompleted(course.id,course.chapters[0].id,false); expect((await loadProgress(makeCourse())).chapters[0].completed).toBe(false);
});
it('keeps concurrent chapter writes and separate course progress independent', async () => {
  const course = makeCourse(); await Promise.all(course.chapters.slice(0,2).map(c => setCompleted(course.id,c.id,true)));
  expect((await loadProgress(makeCourse())).chapters.map(c => c.completed)).toEqual([true,true,false]);
  expect((await loadProgress({...course,id:'another-course'})).chapters.every(c => !c.completed)).toBe(true);
});
it('propagates save failures so the UI can show a retry message', async () => {
  vi.stubGlobal('chrome', {storage:{local:{set:async()=>{throw new Error('quota');}}}});
  await expect(setCompleted('course','chapter',true)).rejects.toThrow('quota');
});
