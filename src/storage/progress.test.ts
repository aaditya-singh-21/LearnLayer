import { beforeEach, expect, it, vi } from 'vitest';
import { loadProgress, setCompleted } from './progress';
import { normalize } from '../detection/normalize';
const disk: Record<string, unknown> = {};
beforeEach(() => { for (const k of Object.keys(disk)) delete disk[k]; vi.stubGlobal('chrome', { storage: { local: { get: async (keys: string[]) => Object.fromEntries(keys.map(k => [k,disk[k]])), set: async (values: Record<string,unknown>) => Object.assign(disk, values) } } }); });
const makeCourse = () => normalize('System Design','https://example.com/system-design',[{title:'One',url:'https://example.com/system-design/1'},{title:'Two',url:'https://example.com/system-design/2'},{title:'Three',url:'https://example.com/system-design/3'}],'navigation');
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
