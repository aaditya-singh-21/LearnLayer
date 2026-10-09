// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { detectLearningReport } from './detect';
const doc=(html:string)=>new DOMParser().parseFromString(html,'text/html');
const fixture=(endpoint='/lesson',key='path',scope='phases/06-audio')=>`<header><nav><a href="/">Contents</a></nav></header><aside class="lesson-sidebar"><div class="sidebar-phase-nav"><a href="${endpoint}?${key}=phases/05-text/01-reading">Previous phase</a><a href="${endpoint}?${key}=phases/07-models/01-transformers">Next phase</a></div><div class="sidebar-phase-header">Phase 06 · Speech &amp; Audio</div>${['Audio fundamentals','Spectrograms and features','Speech recognition','Voice synthesis'].map((title,i)=>`<a href="${endpoint}?${key}=${encodeURIComponent(scope+'/'+String(i+1).padStart(2,'0')+'-topic')}&lang=en">${title}</a>`).join('')}</aside><aside><nav aria-label="On this page"><a href="#problem">The Problem</a><a href="#concept">The Concept</a><a href="#build">Build It</a></nav></aside><main><h1>Audio fundamentals</h1></main>`;
it('detects query-routed lesson sidebars across domains and excludes adjacent phases and article contents',()=>{
 for(const host of ['aiengineeringfromscratch.com','unseen.example']) {
  const html=fixture(), base=`https://${host}`;
  const first=detectLearningReport(doc(html),base+'/lesson?lang=en&path=phases/06-audio/01-topic');
  const next=detectLearningReport(doc(html),base+'/lesson?path=phases%2F06-audio%2F02-topic&lang=en');
  expect(first.status).toBe('detected');expect(first.candidates.filter(c=>c.detectorId==='curriculum-navigation')).toHaveLength(1);
  expect(first.selected?.course.title).toBe('Phase 06 · Speech & Audio');
  expect(first.selected?.course.chapters).toHaveLength(4);
  expect(first.selected?.course.chapters.every(c=>new URL(c.url!).searchParams.get('path')?.startsWith('phases/06-audio/'))).toBe(true);
  expect(new URL(first.selected!.course.sourceUrl).searchParams.get('path')).toBe('phases/06-audio');
  expect(next.selected?.course.id).toBe(first.selected?.course.id);
  expect(next.selected?.course.chapters.map(c=>c.id)).toEqual(first.selected?.course.chapters.map(c=>c.id));
 }
});
it('generalizes to other endpoint and parameter names, including an accessible sidebar label',()=>{
 const html=fixture('/read','document','courses/audio').replace('class="lesson-sidebar"','aria-labelledby="course-label"').replace('class="sidebar-phase-header"','id="course-label"');
 const report=detectLearningReport(doc(html),'https://example.com/read?document=courses/audio/02-topic&lang=en');
 expect(report.status).toBe('detected');expect(report.selected?.course.chapters).toHaveLength(4);
 expect(report.selected?.course.title).toBe('Phase 06 · Speech & Audio');
});
it('does not treat product query paths or numeric IDs as a course, even under a Learn label',()=>{
 for(const values of [['products/audio/01-device','products/audio/02-device','products/audio/03-device'],['101','102','103']]) {
  const html='<aside aria-label="Learn">'+values.map((path,i)=>`<a href="/view?item=${path}">Product ${i+1}</a>`).join('')+'</aside>';
  expect(detectLearningReport(doc(html),`https://example.com/view?item=${values[0]}`).status).toBe('unsupported');
 }
});
it('keeps phase identities distinct and ignores groups that do not contain the current lesson',()=>{
 const first=detectLearningReport(doc(fixture()),'https://example.com/lesson?path=phases/06-audio/01-topic&lang=en');
 const other=detectLearningReport(doc(fixture('/lesson','path','phases/07-models')),'https://example.com/lesson?path=phases/07-models/01-topic&lang=en');
 expect(other.selected?.course.id).not.toBe(first.selected?.course.id);
 expect(detectLearningReport(doc(fixture('/read','document')),'https://example.com/read?document=other/section/item').status).toBe('unsupported');
});
