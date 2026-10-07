import { normalize } from './normalize';
import { pageUrl } from '../utils/identity';
import type { DetectionCandidate } from '../types';
import { detectionPolicy } from './policy';
export function headingCandidates(doc: Document, url: string): DetectionCandidate[] {
  const main = doc.querySelector('main,article');
  if (!main || !/\b(course|tutorial|documentation|docs|learn|guide)\b/i.test(doc.title + ' ' + main.querySelector('h1')?.textContent)) return [];
  const headings = [...main.querySelectorAll('h2[id],h3[id]')];
  if (headings.filter(h => h.tagName === 'H2').length < 3) return [];
  let parentUrl: string | undefined;
  const items = headings.map(h => {
    const target = pageUrl(url) + '#' + encodeURIComponent(h.id);
    const item = { title: (h.textContent || '').trim(), url: target, ...(h.tagName === 'H3' && parentUrl ? { parentUrl } : {}) };
    if (h.tagName === 'H2') parentUrl = target;
    return item;
  });
  return [{ course: normalize((main.querySelector('h1')?.textContent || doc.title).trim(), pageUrl(url), items, 'headings'), detectorId: 'anchored-sections', score: detectionPolicy.headingScore, reasons: ['Educational article title', 'At least three anchored sections'] }];
}
