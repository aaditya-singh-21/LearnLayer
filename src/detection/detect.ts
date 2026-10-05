import { normalize, type DetectedItem } from './normalize';
import { canonicalUrl, pageUrl } from '../utils/identity';
import type { LearningCourse } from '../types';
const sequence = /\b(chapter|lesson|module|part)\s*\d+/i;
const educational = /\b(course|tutorial|documentation|docs|learn|guide|chapters|lessons|modules|series|curriculum)\b/i;
const clean = (text: string | null | undefined) => (text || '').replace(/\s+/g, ' ').trim();
const prettify = (text: string) => text.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
function sharedPath(items: DetectedItem[]): string {
  const paths = items.map(item => new URL(item.url!).pathname.split('/').filter(Boolean));
  const shared: string[] = [];
  for (let i = 0; i < paths[0].length; i++) { if (paths.every(p => p[i] === paths[0][i])) shared.push(paths[0][i]); else break; }
  return '/' + shared.join('/');
}
export function detectLearningStructure(doc: Document, currentUrl: string): LearningCourse | null {
  const current = new URL(currentUrl);
  const candidates: { course: LearningCourse; score: number }[] = [];
  for (const container of doc.querySelectorAll('nav, aside, [role="navigation"], [class*="sidebar"], [class*="curriculum"], [class*="course"], ol, ul')) {
    if (container.closest('#learnlayer-root, header, footer')) continue;
    const label = clean(container.getAttribute('aria-label') || container.querySelector('h1,h2,h3,[class*="title"]')?.textContent || '');
    const items: DetectedItem[] = [];
    for (const link of container.querySelectorAll('a[href]')) {
      const title = clean(link.textContent);
      if (title.length < 3 || title.length > 180 || /^(home|login|sign in|contact|privacy|terms|about|pricing|next|previous)$/i.test(title)) continue;
      try { const url = new URL(link.getAttribute('href')!, currentUrl); if (!/^https?:$/.test(url.protocol) || url.origin !== current.origin) continue; items.push({ title, url: canonicalUrl(url.href) }); } catch { /* malformed link */ }
    }
    const unique = [...new Map(items.map(item => [item.url, item])).values()];
    if (unique.length < 3 || unique.length > 150) continue;
    const numbered = unique.filter(item => sequence.test(item.title)).length;
    const hint = educational.test(label + ' ' + container.className);
    const path = sharedPath(unique);
    const pathHint = educational.test(path.replace(/[-_/]/g, ' '));
    if (numbered < 3 && !hint && !pathHint) continue;
    const crossPage = unique.filter(item => pageUrl(item.url!) !== pageUrl(currentUrl)).length;
    // Generic menus and unrelated article link lists are not a learning sequence.
    if (!numbered && !hint && (!pathHint || !container.matches('nav,aside,[role="navigation"],[class*="sidebar"]'))) continue;
    const sourceUrl = crossPage ? current.origin + path : pageUrl(currentUrl);
    const rootLink = [...doc.querySelectorAll('a[href]')].find(a => { try { return pageUrl(new URL(a.getAttribute('href')!, currentUrl).href) === pageUrl(sourceUrl) && clean(a.textContent).length > 2; } catch { return false; } });
    const title = crossPage ? clean(rootLink?.textContent || '') || (label && !/^(chapters|lessons|modules|navigation|table of contents|on this page)$/i.test(label) ? label : prettify(path.split('/').filter(Boolean).at(-1) || current.hostname)) : clean(doc.querySelector('h1')?.textContent || doc.title);
    candidates.push({ course: normalize(title, sourceUrl, unique, 'navigation'), score: numbered * 8 + (hint ? 15 : 0) + (crossPage ? 30 : 0) + Math.min(unique.length, 20) });
  }
  candidates.sort((a,b) => b.score - a.score);
  if (candidates.length) return candidates[0].course;
  const main = doc.querySelector('main,article');
  if (!main || !educational.test(doc.title + ' ' + clean(main.querySelector('h1')?.textContent))) return null;
  const headings = [...main.querySelectorAll('h2[id],h3[id]')];
  if (headings.filter(h => h.tagName === 'H2').length < 3) return null;
  return normalize(clean(main.querySelector('h1')?.textContent || doc.title), pageUrl(currentUrl), headings.map(h => ({ title: clean(h.textContent), url: pageUrl(currentUrl) + '#' + encodeURIComponent(h.id) })), 'headings');
}
