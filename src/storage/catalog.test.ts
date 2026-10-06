import { describe, expect, it } from 'vitest';
import { reduceCatalog, resolveStored, validateCourse, type Catalog } from './catalog';
import { normalize } from '../detection/normalize';
const course = (n = 0) => normalize(`Course ${n}`,`https://example.com/course-${n}`,[{ title:'One', url:`https://example.com/course-${n}/one` },{ title:'Two',url:`https://example.com/course-${n}/two` }],'navigation');
describe('course metadata', () => {
  it('retains only five recent memberships but keeps evicted definitions', () => {
    let state: Catalog = {};
    for (let i=0;i<7;i++) state=reduceCatalog(state,{type:'complete',course:course(i)},i+1);
    expect(Object.values(state).filter(r=>r.membership==='recent')).toHaveLength(5);
    expect(Object.keys(state)).toHaveLength(7); expect(state[course(0).id].membership).toBeNull();
  });
  it('saved courses do not consume recent slots and unsave returns them', () => {
    let state=reduceCatalog({}, {type:'save',course:course()},1);
    for (let i=1;i<7;i++) state=reduceCatalog(state,{type:'complete',course:course(i)},i+1);
    expect(state[course().id].membership).toBe('saved');
    state=reduceCatalog(state,{type:'unsave',course:course()},20);
    expect(state[course().id].membership).toBe('recent'); expect(Object.values(state).filter(r=>r.membership==='recent')).toHaveLength(5);
  });
  it('corrections neither enroll nor get overwritten by visits', () => {
    const edited={...course(),title:'My title'};
    const state=reduceCatalog({}, {type:'edit',course:edited},1);
    expect(state[edited.id].membership).toBeNull(); expect(reduceCatalog(state,{type:'visit',course:course(),url:course().chapters[0].url},2)).toEqual(state);
    const saved=reduceCatalog(state,{type:'save',course:course()},3);
    expect(saved[edited.id].course.title).toBe('My title');
  });
  it('preserves IDs and completion when renamed, reordered, or restored', () => {
    const original=course(); original.chapters[0].completed=true;
    const edited=validateCourse({...original,title:'Renamed',chapters:[...original.chapters].reverse()},original);
    expect(edited.id).toBe(original.id); expect(edited.chapters[1]).toEqual(original.chapters[0]);
    expect(validateCourse({...original,chapters:[{...original.chapters[0],url:'/course-0/new'}]},original).chapters[0].completed).toBe(false);
  });
  it('validates empty, duplicate, unsafe, and cross-origin chapter URLs', () => {
    expect(()=>validateCourse({...course(),title:''})).toThrow(); expect(()=>validateCourse({...course(),chapters:[]})).toThrow();
    for (const url of ['javascript:alert(1)','https://elsewhere.com/chapter','mailto:test@example.com']) expect(()=>validateCourse({...course(),chapters:[{...course().chapters[0],url}]})).toThrow();
    expect(()=>validateCourse({...course(),chapters:[course().chapters[0],course().chapters[0]]})).toThrow('duplicate');
    expect(validateCourse({...course(),chapters:[{...course().chapters[0],url:'/course-0/one#section'}]}).chapters[0].url).toContain('#section');
  });
  it('resolves corrections on chapter URLs and renamed automatic courses', () => {
    const state=reduceCatalog({}, {type:'edit',course:course()},1);
    expect(resolveStored(state,course().chapters[0].url!,null)).toHaveLength(1);
    expect(resolveStored(state,'https://example.com/course-0',{...course(),id:'new-id',title:'New title'})).toHaveLength(1);
  });
});
it('retains manual definitions at their source and remembers selection between overlapping courses',()=>{
 const first=course(), second={...first,id:'other',title:'Other course'};
 let state=reduceCatalog({}, {type:'edit',course:first,url:first.sourceUrl},1);
 expect(resolveStored(state,first.sourceUrl,null)).toHaveLength(1);
 state=reduceCatalog(state,{type:'edit',course:second},2);
 expect(resolveStored(state,first.chapters[0].url!,null)).toHaveLength(2);
 state=reduceCatalog(state,{type:'edit',course:first,url:first.chapters[0].url},3);
 expect(resolveStored(state,first.chapters[0].url!,null).map(r=>r.course.id)).toEqual([first.id]);
});
it('updates recent activity on revisits without enrolling unseen courses',()=>{
 const first=course();
 const state=reduceCatalog({}, {type:'complete',course:first,url:first.chapters[0].url},1);
 expect(reduceCatalog(state,{type:'visit',course:first,url:first.chapters[0].url},10)[first.id].activity).toBe(10);
 expect(reduceCatalog({}, {type:'visit',course:first},10)).toEqual({});
});
it('does not treat a course source page as a visited chapter',()=>{
 const first=course();
 const state=reduceCatalog({}, {type:'save',course:first,url:first.sourceUrl},1);
 expect(state[first.id].lastVisitedUrl).toBeUndefined();
 const visited=reduceCatalog(state,{type:'visit',course:first,url:first.chapters[0].url+'?utm_source=test#intro'},2);
 expect(visited[first.id].lastVisitedUrl).toBe(first.chapters[0].url);
});
