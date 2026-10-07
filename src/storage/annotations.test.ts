import { expect, it } from 'vitest';
import { reduceAnnotation } from './annotations';
const action={courseId:'course',chapterId:'chapter',courseTitle:'Course',title:'Topic',url:'https://example.com/topic#section'};
it('keeps notes and bookmarks independent and supports clearing either field',()=>{
 const note=reduceAnnotation(undefined,{...action,note:'Recall closure scope'},1);
 const bookmark=reduceAnnotation(note,{...action,bookmarked:true},2);
 expect(bookmark.note).toBe(note.note);expect(bookmark.bookmarked).toBe(true);
 const cleared=reduceAnnotation(bookmark,{...action,note:''},3);
 expect(cleared.bookmarked).toBe(true);
 expect(reduceAnnotation(cleared,{...action,bookmarked:false},4).note).toBe('');
});
it('validates unsafe URLs and oversized notes and treats note contents as plain text',()=>{
 expect(()=>reduceAnnotation(undefined,{...action,url:'javascript:alert(1)',note:'test'})).toThrow('HTTP');
 expect(()=>reduceAnnotation(undefined,{...action,note:'x'.repeat(20001)})).toThrow('20,000');
 expect(reduceAnnotation(undefined,{...action,note:'<script>text</script>'}).note).toBe('<script>text</script>');
});
