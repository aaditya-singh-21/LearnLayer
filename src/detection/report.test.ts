// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { detectLearningReport, detectLearningStructure, detectionPolicy } from './detect';
const doc=(html:string)=>new DOMParser().parseFromString(html,'text/html');
const list=(prefix:string)=>`<nav aria-label="Chapters">${[1,2,3].map(i=>`<a href="/${prefix}/${i}">Chapter ${i}: Topic</a>`).join('')}</nav>`;
it('automatically uses a sole structurally valid candidate even below the ranking threshold',()=>{
 const page=doc('<title>Reference</title><nav aria-label="Documentation"><a href="#a">Introduction</a><a href="#b">Examples</a><a href="#c">Exercises</a></nav>');
 const report=detectLearningReport(page,'https://example.com/reference');
 expect(report.candidates).toHaveLength(1);
 expect(report.candidates[0].score).toBeLessThan(detectionPolicy.minimumScore);
 expect(report.status).toBe('detected');
 expect(report.selected?.course.chapters).toHaveLength(3);
 expect(detectLearningStructure(page,'https://example.com/reference')).toEqual(report.selected?.course);
});
it('generalizes across domains and deduplicates responsive structures',()=>{
 for (const host of ['example.com','unseen.test','another.org']) { const report=detectLearningReport(doc(list('course')+list('course')),`https://${host}/course/1`); expect(report.status).toBe('detected'); expect(report.candidates).toHaveLength(1); }
});
it('requires selection for similarly strong, distinct sequences',()=>{ expect(detectLearningReport(doc(list('course')+list('other')),'https://example.com/course/1').status).toBe('ambiguous'); });
it('rejects a learning label alone on unrelated menus',()=>{ expect(detectLearningReport(doc('<nav aria-label="Learn"><a href="/a">Product A</a><a href="/b">Product B</a><a href="/c">Product C</a></nav>'),'https://example.com').status).toBe('unsupported'); });
it('deduplicates nested lists and prefers a course over page sections',()=>{
 const html='<a href="/course">Course title</a>'+list('course').replace('</nav>','<ul>'+[1,2,3].map(i=>`<li><a href="/course/${i}">Chapter ${i}: Topic</a></li>`).join('')+'</ul></nav>')+'<main><h1>Learning tutorial</h1><h2 id="a">Start</h2><h2 id="b">Practice</h2><h2 id="c">Finish</h2></main>';
 const report=detectLearningReport(doc(html),'https://example.com/course/1');expect(report.status).toBe('detected');expect(report.selected?.detectorId).toBe('curriculum-navigation');expect(report.candidates.filter(c=>c.detectorId==='curriculum-navigation')).toHaveLength(1);
});
