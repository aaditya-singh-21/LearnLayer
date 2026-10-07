// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { detectLearningReport, detectLearningStructure, detectionPolicy } from './detect';
const doc=(html:string)=>new DOMParser().parseFromString(html,'text/html');
const list=(prefix:string)=>`<nav aria-label="Chapters">${[1,2,3].map(i=>`<a href="/${prefix}/${i}">Chapter ${i}: Topic</a>`).join('')}</nav>`;
it('detects book sidebars with hierarchical numbers and stable identity across chapters',()=>{
 const html='<div role="dialog"><h1>Keyboard shortcuts</h1></div><div class="menu-bar"><h1>Example programming book</h1></div><nav class="sidebar" aria-label="Table of contents"><ol><li><a href="intro.html">Introduction</a></li><li><a href="start.html"><strong>1.</strong> Getting Started</a><ol><li><a href="install.html"><strong>1.1.</strong> Installation</a></li><li><a href="hello.html"><strong>1.2.</strong> Hello World</a></li></ol></li><li><a href="concepts.html"><strong>2.</strong> Common Concepts</a></li></ol></nav><main><h1>Getting Started</h1></main>';
 for(const host of ['doc.rust-lang.org','unseen.example']) {
  const firstDoc=doc(html);firstDoc.documentElement.className='sidebar-visible';firstDoc.body.className='course-open';
  const first=detectLearningReport(firstDoc,`https://${host}/book/start.html`);
  const next=detectLearningReport(doc(html.replace('<main><h1>Getting Started','<main><h1>Installation')),`https://${host}/book/install.html`);
  expect(first.status).toBe('detected');expect(first.selected?.course.title).toBe('Example programming book');
  expect(first.selected?.course.chapters).toHaveLength(5);expect(next.selected?.course.id).toBe(first.selected?.course.id);
  expect(first.selected?.detectorId).toBe('curriculum-navigation');
 }
});
it('does not infer a course from bare numbers on a product sidebar',()=>{
 const html='<aside><ol>'+[1,2,3].map(i=>`<li><a href="/products/${i}">${i}. Product ${i}</a></li>`).join('')+'</ol></aside>';
 expect(detectLearningReport(doc(html),'https://example.com/products/1').status).toBe('unsupported');
});
it('ignores dynamically inserted article headings inside cross-page book navigation',()=>{
 const chapters=[1,2,3,4].map(i=>`<a href="/book/${i}.html">${i}. Topic ${i}</a>`).join('');
 const html=`<h1>Programming book</h1><nav class="sidebar" aria-label="Table of contents"><div class="sidebar-scrollbox">${chapters}</div><ol><li><a href="/book/1.html#topic">Topic 1</a></li></ol></nav>`;
 const report=detectLearningReport(doc(html),'https://example.com/book/1.html');
 expect(report.status).toBe('detected');expect(report.candidates).toHaveLength(1);
 expect(report.selected?.course.chapters).toHaveLength(4);
 expect(report.selected?.course.chapters.every(c=>!new URL(c.url!).hash)).toBe(true);
});
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
it('detects a nested curriculum in main content at an index, not its section sublists',()=>{
 const list='<ul>'+[1,2,3,4].map(i=>`<li><a href="lesson-${i}.html">${i}. Lesson ${i}</a><ul><li><a href="lesson-${i}.html#one">${i}.1. First section</a></li><li><a href="lesson-${i}.html#two">${i}.2. Second section</a></li><li><a href="lesson-${i}.html#three">${i}.3. Third section</a></li></ul></li>`).join('')+'</ul>';
 const html='<div role="main"><h1>The Programming Tutorial<a href="#title">¶</a></h1>'+list+'</div>';
 for (const host of ['docs.python.org','unseen.example']) for(const index of ['', 'index.html']) {
  const report=detectLearningReport(doc(html),`https://${host}/3/tutorial/${index}`);
  expect(report.status).toBe('detected');expect(report.candidates).toHaveLength(1);
  expect(report.selected?.course.title).toBe('The Programming Tutorial');
  expect(report.selected?.course.chapters).toHaveLength(16);expect(report.selected?.course.sourceUrl).toBe(`https://${host}/3/tutorial`);
  const chapters=report.selected!.course.chapters;
  expect(chapters.filter(c=>!c.parentId)).toHaveLength(4);
  expect(chapters[1].parentId).toBe(chapters[0].id);
 }
});
it('rejects uncontextualized numbered link lists in main content',()=>{
 const html='<main><h1>Our products</h1><ul>'+[1,2,3].map(i=>`<li><a href="/products/${i}">${i}. Product ${i}</a></li>`).join('')+'</ul></main>';
 expect(detectLearningReport(doc(html),'https://example.com/products/').status).toBe('unsupported');
});
it('nests article H3 sections under the preceding H2',()=>{
 const html='<title>Learning guide</title><main><h1>Learning guide</h1><h2 id="one">First topic</h2><h3 id="detail">A detail</h3><h2 id="two">Second topic</h2><h2 id="three">Third topic</h2></main>';
 const report=detectLearningReport(doc(html),'https://example.com/guide');
 expect(report.status).toBe('detected');
 const chapters=report.selected!.course.chapters;
 expect(chapters[1].parentId).toBe(chapters[0].id);expect(chapters[2].parentId).toBeUndefined();
});
it('uses contextual hierarchical numbering even when a book menu is a flat list',()=>{
 const html='<nav aria-label="Book chapters">'+['1. Introduction','1.1. Install','1.2. Run','2. Practice'].map((title,i)=>`<a href="/book/${i}">${title}</a>`).join('')+'</nav>';
 const chapters=detectLearningReport(doc(html),'https://example.com/book/0').selected!.course.chapters;
 expect(chapters[1].parentId).toBe(chapters[0].id);expect(chapters[2].parentId).toBe(chapters[0].id);expect(chapters[3].parentId).toBeUndefined();
});
it('excludes current-article-only anchors nested beneath a cross-page book sidebar',()=>{
 const html='<nav class="sidebar" aria-label="Book chapters"><ol>'+[1,2,3,4].map(i=>`<li><a href="/book/${i}">${i}. Topic ${i}</a>${i===1?'<ol><li><a href="/book/1#detail">Current article detail</a></li></ol>':''}</li>`).join('')+'</ol></nav>';
 expect(detectLearningReport(doc(html),'https://example.com/book/1').selected!.course.chapters).toHaveLength(4);
});
