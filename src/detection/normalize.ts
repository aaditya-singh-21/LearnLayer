import type { LearningCourse } from '../types';
import { canonicalUrl, stableId } from '../utils/identity';
export type DetectedItem = { title: string; url?: string; parentUrl?: string };
export function normalize(title: string, sourceUrl: string, items: DetectedItem[], kind: LearningCourse['kind']): LearningCourse {
  const id = stableId(`${canonicalUrl(sourceUrl)}|${title.toLowerCase()}`);
  const seen = new Set<string>();
  const unique = items.filter(item => { const key = item.url ? canonicalUrl(item.url) : item.title.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
  const chapters = unique.map(item => ({ title: item.title, url: item.url, id: stableId(`${id}|${item.url ? canonicalUrl(item.url) : item.title.toLowerCase()}`), completed: false,
    ...(item.parentUrl && unique.some(p => p.url && canonicalUrl(p.url) === canonicalUrl(item.parentUrl!)) && item.url !== item.parentUrl ? { parentId: stableId(`${id}|${canonicalUrl(item.parentUrl)}`) } : {}) }));
  return { id, title, sourceUrl: canonicalUrl(sourceUrl), chapters, kind };
}
