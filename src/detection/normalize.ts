import type { LearningCourse } from '../types';
import { canonicalUrl, stableId } from '../utils/identity';
export type DetectedItem = { title: string; url?: string };
export function normalize(title: string, sourceUrl: string, items: DetectedItem[], kind: LearningCourse['kind']): LearningCourse {
  const id = stableId(`${canonicalUrl(sourceUrl)}|${title.toLowerCase()}`);
  const seen = new Set<string>();
  const chapters = items.filter(item => { const key = item.url ? canonicalUrl(item.url) : item.title.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).map(item => ({ ...item, id: stableId(`${id}|${item.url ? canonicalUrl(item.url) : item.title.toLowerCase()}`), completed: false }));
  return { id, title, sourceUrl: canonicalUrl(sourceUrl), chapters, kind };
}
