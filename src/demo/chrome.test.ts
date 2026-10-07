// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { installPreviewChrome } from './chrome';
import { normalize } from '../detection/normalize';
import { loadProgress, setCompleted } from '../storage/progress';
import { saveAnnotation, readAnnotations } from '../storage/annotations';
import { mutateCatalog } from '../storage/catalog';
it('preview supports serialized notes/bookmarks and incomplete newly added subsections',async()=>{
 localStorage.clear();vi.stubGlobal('chrome',undefined);installPreviewChrome();
 const base='https://example.com/tutorial';
 const c=normalize('Tutorial',base,[{title:'Parent',url:base+'/one'}],'navigation');
 await mutateCatalog({type:'save',course:c});await setCompleted(c.id,c.chapters[0].id,true);
 const edited=normalize(c.title,base,[{title:'Parent',url:base+'/one'},{title:'New subsection',url:base+'/one#new',parentUrl:base+'/one'}],'navigation');
 await mutateCatalog({type:'edit',course:edited});
 expect((await loadProgress(edited)).chapters.map(c=>c.completed)).toEqual([false,false]);
 await Promise.all([saveAnnotation(edited,edited.chapters[1],{note:'Preview note'}),saveAnnotation(edited,edited.chapters[1],{bookmarked:true})]);
 expect(Object.values(await readAnnotations())[0]).toMatchObject({note:'Preview note',bookmarked:true});
 vi.unstubAllGlobals();
});
