import type { CourseRecord, LearningCourse } from '../types';
import { canonicalUrl, pageUrl, stableId } from '../utils/identity';
import { currentChapter } from '../utils/progress';
import { orderedChapters } from '../utils/tree';
export const catalogKey = 'll:v2:catalog';
export type Catalog = Record<string, CourseRecord>;
export type CatalogAction = { type: 'discover' | 'save' | 'unsave' | 'edit' | 'complete' | 'visit'; course: LearningCourse; url?: string; corrected?: boolean };
export async function readCatalog(): Promise<Catalog> { return ((await chrome.storage.local.get([catalogKey]))[catalogKey] || {}) as Catalog; }
export function reduceCatalog(catalog: Catalog, action: CatalogAction, now = Date.now()): Catalog {
  const result = structuredClone(catalog);
  const prior = result[action.course.id];
  if (action.type === 'discover' && prior) {
    if (!prior.corrected && action.course.chapters.some(c => c.parentId) && JSON.stringify(prior.course) !== JSON.stringify(action.course)) prior.course = action.course;
    return result;
  }
  if (action.type === 'visit' && (!prior || !prior.membership)) return result;
  const record: CourseRecord = prior || { version: 2, course: action.course, originalId: action.course.id, corrected: false, membership: null, activity: now };
  if (action.type === 'edit') { record.course = action.course; record.corrected = action.corrected ?? true; }
  else if (!record.corrected) record.course = action.course;
  if (action.type === 'save') record.membership = 'saved';
  if (action.type === 'unsave') record.membership = 'recent';
  if (action.type === 'complete' && record.membership !== 'saved') record.membership = 'recent';
  if (action.type === 'edit' && action.url) {
    const selected = canonicalUrl(action.url);
    for (const other of Object.values(result)) other.preferredPages = other.preferredPages?.filter(url => url !== selected);
    record.preferredPages = [...new Set([...(record.preferredPages || []), selected])];
  } else if (action.url) {
    const visited = currentChapter(record.course, action.url);
    if (visited?.url) record.lastVisitedUrl = canonicalUrl(visited.url);
  }
  record.activity = now;
  result[record.course.id] = record;
  Object.values(result).filter(r => r.membership === 'recent').sort((a,b) => b.activity - a.activity).slice(5).forEach(r => { r.membership = null; });
  return result;
}
export async function mutateCatalog(action: CatalogAction) {
  const response = await chrome.runtime.sendMessage({ type: 'LL_CATALOG', action });
  if (!response?.ok) throw new Error(response?.error || 'Could not save course. Please retry.');
}
export function resolveStored(catalog: Catalog, url: string, detected: LearningCourse | null): CourseRecord[] {
  const records = Object.values(catalog);
  const preferred = records.filter(r => r.preferredPages?.includes(canonicalUrl(url)));
  if (preferred.length === 1) return preferred;
  const exact = records.filter(r => r.course.chapters.some(c => c.url && (canonicalUrl(c.url) === canonicalUrl(url) || (!new URL(c.url).hash && pageUrl(c.url) === pageUrl(url)))));
  if (exact.length) return exact;
  if (!detected) return records.filter(r => pageUrl(r.course.sourceUrl) === pageUrl(url));
  return records.filter(r => r.originalId === detected.id || (canonicalUrl(r.course.sourceUrl) === canonicalUrl(detected.sourceUrl) && detected.chapters.some(c => r.course.chapters.some(s => s.url === c.url))));
}
export function storedDefinition(record: CourseRecord, detected: LearningCourse | null): LearningCourse {
  if (record.corrected || !detected || canonicalUrl(record.course.sourceUrl) !== canonicalUrl(detected.sourceUrl)) return record.course;
  if (record.course.chapters.some(c => c.parentId) && (!detected.chapters.some(c => c.parentId) || detected.chapters.length < record.course.chapters.length)) return record.course;
  const ids = new Map(detected.chapters.map(c => [c.id, record.course.chapters.find(s => s.url === c.url)?.id || stableId(`${record.course.id}|${c.url}`)]));
  return { ...detected, id: record.course.id, chapters: detected.chapters.map(chapter => ({ ...chapter, id: ids.get(chapter.id)!, ...(chapter.parentId ? { parentId: ids.get(chapter.parentId) } : {}) })) };
}
export function validateCourse(draft: LearningCourse, original?: LearningCourse): LearningCourse {
  if (!draft.title.trim()) throw new Error('Enter a course title.');
  if (!draft.chapters.length || draft.chapters.length > 150) throw new Error('Use between 1 and 150 chapters.');
  const source = new URL(draft.sourceUrl);
  if (!/^https?:$/.test(source.protocol)) throw new Error('Use an HTTP or HTTPS source.');
  const seen = new Set<string>();
  const ids = new Map<string,string>();
  const chapters = draft.chapters.map(c => {
    if (!c.title.trim() || !c.url?.trim()) throw new Error('Every chapter needs a title and URL.');
    const url = canonicalUrl(c.url, source.href);
    if (!/^https?:$/.test(new URL(url).protocol) || new URL(url).origin !== source.origin) throw new Error('Chapter URLs must be HTTP/HTTPS links on the same site.');
    if (seen.has(url)) throw new Error('Remove duplicate chapter URLs.'); seen.add(url);
    const retained = original?.chapters.find(ch => ch.url && canonicalUrl(ch.url) === url);
    const id = retained?.id || stableId(`${draft.id}|${url}`);
    if (ids.has(c.id)) throw new Error('Every chapter needs a unique identifier.');
    ids.set(c.id,id);
    return { title: c.title.trim(), url, id, completed: retained?.completed || false, ...(c.parentId ? { parentId:c.parentId } : {}) };
  });
  for (const c of chapters) {
    if (c.parentId) { const parent = ids.get(c.parentId); if (!parent) throw new Error('Choose an existing parent chapter.'); c.parentId = parent; }
  }
  for (const c of chapters) {
    const seenParents = new Set([c.id]); let parent = c.parentId;
    while (parent) { if (seenParents.has(parent)) throw new Error('A chapter cannot contain itself or its parent.'); seenParents.add(parent); parent = chapters.find(p => p.id === parent)?.parentId; }
  }
  return { ...draft, title: draft.title.trim(), chapters: orderedChapters(chapters) };
}
