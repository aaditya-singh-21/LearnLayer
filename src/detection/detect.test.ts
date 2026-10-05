// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { detectLearningStructure } from './detect';
import { normalize } from './normalize';
import { currentChapter, nextChapter } from '../utils/progress';
const documentFor = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const links = ['Scale from Zero', 'Estimation', 'Interview Framework', 'Rate Limiter'].map((title,i) => `<li><a href="/system-design/chapter-${i+1}">Chapter ${i+1}: ${title}</a></li>`).join('');
const fixture = `<header><nav><a href="/">Home</a><a href="/about">About</a></nav></header><a href="/system-design">System Design</a><nav aria-label="Chapters"><ul>${links}</ul></nav><aside hidden><nav aria-label="Chapters"><ul>${links}</ul></nav></aside><main><h1>Chapter 1: Scale from Zero</h1><nav aria-label="Table of contents"><a href="#one">Introduction</a><a href="#two">Setup</a><a href="#three">Conclusion</a></nav></main>`;
describe('DOM learning detection', () => {
  it('prefers cross-page chapters and deduplicates responsive sidebars', () => {
    const course = detectLearningStructure(documentFor(fixture), 'https://codejeet.com/system-design/chapter-1')!;
    expect(course.title).toBe('System Design'); expect(course.chapters).toHaveLength(4); expect(course.sourceUrl).toBe('https://codejeet.com/system-design');
  });
  it('retains course and chapter identity on another chapter and reload', () => {
    const first = detectLearningStructure(documentFor(fixture), 'https://example.com/system-design/chapter-1')!;
    const next = detectLearningStructure(documentFor(fixture.replace('Chapter 1: Scale from Zero</h1>', 'Chapter 2: Estimation</h1>')), 'https://example.com/system-design/chapter-2')!;
    expect(next.id).toBe(first.id); expect(next.chapters.map(c => c.id)).toEqual(first.chapters.map(c => c.id));
  });
  it('rejects ordinary marketing navigation and unrelated article headings', () => {
    expect(detectLearningStructure(documentFor('<nav><a href="/about">About us</a><a href="/products">Products</a><a href="/contact">Contact us</a></nav><main><h1>News</h1><h2 id="a">Today</h2><h2 id="b">Yesterday</h2><h2 id="c">Tomorrow</h2></main>'), 'https://example.com')).toBeNull();
  });
  it('detects labeled documentation navigation without chapter numbers', () => {
    const html = '<nav aria-label="Documentation"><a href="/docs/start">Getting started</a><a href="/docs/setup">Installation</a><a href="/docs/api">API reference</a></nav>';
    expect(detectLearningStructure(documentFor(html), 'https://example.com/docs/setup')?.chapters).toHaveLength(3);
  });
  it('supports explicit heading anchors on educational pages', () => {
    const course = detectLearningStructure(documentFor('<main><h1>TypeScript Tutorial</h1><h2 id="start">Basics</h2><h3 id="types">Types</h3><h2 id="functions">Functions</h2><h2 id="finish">Practice</h2></main>'), 'https://example.com/tutorial')!;
    expect(course.kind).toBe('headings'); expect(currentChapter(course, 'https://example.com/tutorial#types')?.title).toBe('Types');
    expect(currentChapter(course, 'https://example.com/tutorial')).toBeUndefined();
  });
  it('rejects off-origin and unsafe links', () => {
    expect(detectLearningStructure(documentFor('<nav aria-label="Chapters"><a href="javascript:alert(1)">Chapter 1</a><a href="https://elsewhere.com/2">Chapter 2</a><a href="mailto:a@a.com">Chapter 3</a></nav>'), 'https://example.com')).toBeNull();
  });
  it('matches current page ignoring tracking query and selects next incomplete', () => {
    const course = detectLearningStructure(documentFor(fixture), 'https://example.com/system-design/chapter-1')!;
    expect(currentChapter(course, 'https://example.com/system-design/chapter-1/?utm_source=x#intro')?.id).toBe(course.chapters[0].id);
    course.chapters[0].completed = true; course.chapters[1].completed = true;
    expect(nextChapter(course, 'https://example.com/system-design/chapter-1')?.id).toBe(course.chapters[2].id);
    course.chapters.forEach(c => c.completed = true); expect(nextChapter(course, 'https://example.com/system-design/chapter-1')).toBeUndefined();
  });
  it('normalizes duplicate URLs and creates deterministic IDs', () => {
    const items = [{title:'One',url:'https://example.com/a'},{title:'One',url:'https://example.com/a/'},{title:'Two',url:'https://example.com/b'}];
    expect(normalize('Course','https://example.com',items,'navigation')).toEqual(normalize('Course','https://example.com',items,'navigation'));
    expect(normalize('Course','https://example.com',items,'navigation').chapters).toHaveLength(2);
  });
});
