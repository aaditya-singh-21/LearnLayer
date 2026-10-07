import { normalize, type DetectedItem } from './normalize';
import { canonicalUrl, pageUrl } from '../utils/identity';
import type { DetectionCandidate } from '../types';
import { detectionPolicy as weights } from './policy';
const sequence = /\b(chapter|lesson|module|part)\s*\d+/i;
const numericSequence = /^\d+(?:\.\d+)*[.)]\s+\S/;
const educational = /\b(book|course|tutorial|documentation|docs|learn|guide|chapters|lessons|modules|series|curriculum)\b/i;
const clean = (text: string | null | undefined) => (text || '').replace(/\s+/g, ' ').trim();
const prettify = (text: string) => text.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
function indexPageUrl(value: string): string {
  const url = new URL(pageUrl(value));
  url.pathname = url.pathname.replace(/\/index\.html?$/i, '/');
  return pageUrl(url.href);
}
function headingTitle(heading: Element | null | undefined): string {
  const copy = heading?.cloneNode(true) as Element | undefined;
  copy?.querySelectorAll('a[href^="#"]').forEach(link => link.remove());
  return clean(copy?.textContent);
}
function sharedPath(items: DetectedItem[]): string {
  const paths = items.map(item => new URL(item.url!).pathname.split('/').filter(Boolean));
  const shared: string[] = [];
  for (let i = 0; i < paths[0].length; i++) { if (paths.every(p => p[i] === paths[0][i])) shared.push(paths[0][i]); else break; }
  return '/' + shared.join('/');
}
export function navigationCandidates(doc: Document, currentUrl: string): DetectionCandidate[] {
  const current = new URL(currentUrl);
  const candidates: DetectionCandidate[] = [];
  for (const container of doc.querySelectorAll('nav, aside, [role="navigation"], [class*="sidebar"], [class*="curriculum"], [class*="course"], ol, ul')) {
    // Page-wide state classes such as "sidebar-visible" are not a sidebar.
    if (container === doc.documentElement || container === doc.body) continue;
    if (container.closest('#learnlayer-root, header, footer')) continue;
    const label = clean(container.getAttribute('aria-label') || container.querySelector('h1,h2,h3,[class*="title"]')?.textContent || '');
    const items: DetectedItem[] = [];
    for (const link of container.querySelectorAll('a[href]')) {
      const title = clean(link.textContent);
      if (title.length < 3 || title.length > 180 || /^(home|login|sign in|contact|privacy|terms|about|pricing|next|previous)$/i.test(title)) continue;
      try {
        const url = new URL(link.getAttribute('href')!, currentUrl);
        if (!/^https?:$/.test(url.protocol) || url.origin !== current.origin) continue;
        // Nested lists express a parent relationship without site-specific selectors.
        const parentLi = link.closest('li')?.parentElement?.closest('li');
        const parentLink = parentLi && [...parentLi.querySelectorAll('a[href]')].find(a => a.closest('li') === parentLi);
        const parentUrl = parentLink ? canonicalUrl(new URL(parentLink.getAttribute('href')!, currentUrl).href) : undefined;
        items.push({ title, url: canonicalUrl(url.href), ...(parentUrl ? { parentUrl } : {}) });
      } catch { /* malformed link */ }
    }
    let unique = [...new Map(items.map(item => [item.url, item])).values()];
    // Ignore detached, transient article contents, but keep nested curriculum sections.
    if (unique.filter(item => pageUrl(item.url!) !== pageUrl(currentUrl)).length >= 3) {
      const chapterPages = new Set(unique.filter(item => !new URL(item.url!).hash).map(item => pageUrl(item.url!)));
      unique = unique.filter(item => item.parentUrl || !new URL(item.url!).hash || !chapterPages.has(pageUrl(item.url!)));
      const anchoredPages = new Set(unique.filter(item => new URL(item.url!).hash).map(item => pageUrl(item.url!)));
      // A book can inject only the current article's headings beneath its TOC.
      // A multi-page index has anchors across chapters; retain that curriculum.
      if (anchoredPages.size === 1 && anchoredPages.has(pageUrl(currentUrl)) && chapterPages.has(pageUrl(currentUrl))) {
        unique = unique.filter(item => !new URL(item.url!).hash);
      }
    }
    if (unique.length < 3 || unique.length > 150) continue;
    const path = sharedPath(unique);
    const pathHint = educational.test(path.replace(/[-_/]/g, ' '));
    const crossPage = unique.filter(item => pageUrl(item.url!) !== pageUrl(currentUrl)).length;
    const main = container.closest('main,article,[role="main"]');
    const indexList = container.matches('ul,ol') && !!main && crossPage >= 3 && pathHint &&
      educational.test(headingTitle(main.querySelector('h1'))) && indexPageUrl(currentUrl) === pageUrl(current.origin + path);
    const semantic = container.matches('nav,aside,[role="navigation"],[class*="sidebar"]') || indexList;
    const toc = /^(table of contents|contents)$/i.test(label);
    const hint = educational.test(label + ' ' + container.className);
    // Bare hierarchical numbering needs navigation and book/learning context.
    // Numbered product lists alone are not evidence of a curriculum.
    const bookNumbers = semantic && path !== '/' && (toc || hint || pathHint);
    const numbered = unique.filter(item => sequence.test(item.title) || bookNumbers && numericSequence.test(item.title)).length;
    if (bookNumbers) {
      const numbers = new Map<string,string>();
      for (const item of unique) {
        const number = item.title.match(/^(?:chapter\s+)?(\d+(?:\.\d+)*)[.)]?\s+/i)?.[1];
        if (!number) continue;
        const parentNumber = number.includes('.') ? number.slice(0,number.lastIndexOf('.')) : '';
        if (!item.parentUrl && numbers.has(parentNumber)) item.parentUrl = numbers.get(parentNumber);
        numbers.set(number,item.url!);
      }
    }
    if (numbered < 3 && !hint && !pathHint) continue;
    // Generic menus and unrelated article link lists are not a learning sequence.
    if (!numbered && !hint && (!pathHint || !semantic)) continue;
    const sourceUrl = crossPage ? current.origin + path : pageUrl(currentUrl);
    const rootLink = [...doc.querySelectorAll('a[href]')].find(a => { try { return pageUrl(new URL(a.getAttribute('href')!, currentUrl).href) === pageUrl(sourceUrl) && clean(a.textContent).length > 2; } catch { return false; } });
    const globalHeadings = [...doc.querySelectorAll('h1')].filter(h => !h.closest('main,article,[role="main"],dialog,[role="dialog"],[hidden]'));
    const bookHeading = globalHeadings.find(h => h.closest('header,[role="banner"],[class*="menu"],[class*="banner"]')) || globalHeadings[0];
    const bookTitle = bookNumbers && toc && numbered >= 3 ? headingTitle(bookHeading) : '';
    const title = crossPage ? (indexList ? headingTitle(main?.querySelector('h1')) : '') || clean(rootLink?.textContent || '') || bookTitle || (label && !/^(chapters|lessons|modules|navigation|table of contents|contents|on this page)$/i.test(label) ? label : prettify(path.split('/').filter(Boolean).at(-1) || current.hostname)) : clean(doc.querySelector('h1')?.textContent || doc.title);
    const member = unique.some(item => pageUrl(item.url!) === pageUrl(currentUrl));
    const coherent = path !== '/';
    if (!numbered && (!coherent || !semantic || (!hint && !pathHint))) continue;
    const mixed = !coherent || numbered > 0 && numbered < unique.length / 2;
    candidates.push({ detectorId: numbered >= 3 ? 'curriculum-navigation' : 'documentation-navigation', reasons: [numbered >= 3 ? 'Numbered learning sequence' : 'Labeled learning navigation', crossPage ? 'Related chapter pages' : 'Anchored page sections', ...(member ? ['Contains current page'] : []), ...(coherent ? ['Shared course path'] : []), ...(mixed ? ['Mixed navigation links'] : [])], course: normalize(title, sourceUrl, unique, 'navigation'), score: numbered * weights.numbered + (hint ? weights.learningLabel : 0) + (crossPage ? weights.crossPage : 0) + (member ? weights.currentPage : 0) + (coherent ? weights.coherentPath : 0) - (mixed ? weights.mixedLinkPenalty : 0) + Math.min(unique.length, weights.linkCap) });
  }
  return candidates;
}
