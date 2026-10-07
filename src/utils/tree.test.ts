import { expect, it } from 'vitest';
import { normalize } from '../detection/normalize';
import { completion, moveBranch, orderedChapters } from './tree';
import { currentChapter, nextChapter } from './progress';
import { validateCourse, reduceCatalog, storedDefinition } from '../storage/catalog';
const base='https://example.com/tutorial';
export const treeCourse=()=>normalize('Tutorial',base,[
  {title:'Chapter 1',url:base+'/one'},
  {title:'1.1 First section',url:base+'/one#first',parentUrl:base+'/one'},
  {title:'1.2 Second section',url:base+'/one#second',parentUrl:base+'/one'},
  {title:'Chapter 2',url:base+'/two'},
],'navigation');
it('counts only leaf topics and resumes exact anchors or incomplete children',()=>{
 const c=treeCourse();c.chapters[0].completed=true;c.chapters[1].completed=true;
 expect(completion(c)).toEqual({done:1,total:3,percent:33});
 expect(currentChapter(c,base+'/one#second')?.id).toBe(c.chapters[2].id);
 expect(nextChapter(c,base+'/one')?.id).toBe(c.chapters[2].id);
 expect(nextChapter(c,base+'/one#second')?.id).toBe(c.chapters[3].id);
});
it('moves whole branches among siblings and orders children after parents',()=>{
 const c=treeCourse(), [parent,first,second,last]=c.chapters;
 expect(moveBranch(c.chapters,parent.id,1).map(c=>c.id)).toEqual([last.id,parent.id,first.id,second.id]);
 expect(moveBranch(c.chapters,second.id,-1).map(c=>c.id)).toEqual([parent.id,second.id,first.id,last.id]);
 expect(orderedChapters([first,last,parent,second]).map(c=>c.id)).toEqual([last.id,parent.id,first.id,second.id]);
});
it('validates parents, rejects cycles and remaps draft IDs while retaining old URLs',()=>{
 const c=treeCourse();
 expect(()=>validateCourse({...c,chapters:c.chapters.map((ch,i)=>i===0?{...ch,parentId:c.chapters[1].id}:ch)},c)).toThrow('itself');
 expect(()=>validateCourse({...c,chapters:[{...c.chapters[0],parentId:'missing'}]})).toThrow('existing parent');
 const draft={...c,chapters:[...c.chapters,{id:'draft',title:'New group',url:base+'/new',completed:false},{id:'draft-child',title:'New child',url:base+'/new#child',parentId:'draft',completed:false}]};
 const valid=validateCourse(draft,c);
 expect(valid.chapters.at(-1)?.parentId).toBe(valid.chapters.at(-2)?.id);
 expect(valid.chapters[0].id).toBe(c.chapters[0].id);
});
it('upgrades uncorrected V2 definitions without enrollment and retains richer curricula on chapter pages',()=>{
 const tree=treeCourse(), flat={...tree,chapters:tree.chapters.filter(c=>!c.parentId)};
 let catalog=reduceCatalog({}, {type:'discover',course:flat},1);
 catalog=reduceCatalog(catalog,{type:'discover',course:tree},2);
 expect(catalog[tree.id].membership).toBeNull();expect(catalog[tree.id].activity).toBe(1);
 expect(storedDefinition(catalog[tree.id],flat).chapters).toHaveLength(4);
 const corrected=reduceCatalog(catalog,{type:'edit',course:flat},3);
 expect(reduceCatalog(corrected,{type:'discover',course:tree},4)[tree.id].course).toEqual(flat);
});
it('remaps parent references when a newly detected title reuses stored identity',()=>{
 const original=treeCourse(), catalog=reduceCatalog({}, {type:'discover',course:original});
 const renamed=normalize('New tutorial title',original.sourceUrl,[{title:'Chapter 1',url:base+'/one'},{title:'Section',url:base+'/one#first',parentUrl:base+'/one'},{title:'Other section',url:base+'/one#second',parentUrl:base+'/one'},{title:'Chapter 2',url:base+'/two'}],'navigation');
 const reused=storedDefinition(catalog[original.id],renamed);
 expect(reused.id).toBe(original.id);expect(reused.chapters[1].parentId).toBe(original.chapters[0].id);expect(reused.chapters[1].id).toBe(original.chapters[1].id);
});
