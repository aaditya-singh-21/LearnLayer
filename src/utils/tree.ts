import type { Chapter, LearningCourse } from '../types';

// Keep a flat, ID-addressable definition for compatibility with V1 progress.
export function descendants(chapters: Chapter[], id: string): Chapter[] {
  const found = new Set([id]);
  for (let changed = true; changed;) {
    changed = false;
    for (const c of chapters) if (c.parentId && found.has(c.parentId) && !found.has(c.id)) { found.add(c.id); changed = true; }
  }
  return chapters.filter(c => found.has(c.id));
}
export function ancestors(chapters: Chapter[], id: string): string[] {
  const result: string[] = [], seen = new Set([id]);
  let parent = chapters.find(c => c.id === id)?.parentId;
  while (parent && !seen.has(parent)) { result.push(parent); seen.add(parent); parent = chapters.find(c => c.id === parent)?.parentId; }
  return result;
}
export function orderedChapters(chapters: Chapter[]): Chapter[] {
  const result: Chapter[] = [], seen = new Set<string>();
  function append(parentId?: string) {
    for (const c of chapters.filter(c => c.parentId === parentId)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id); result.push(c); append(c.id);
    }
  }
  append();
  return result;
}
export function leaves(chapters: Chapter[]): Chapter[] {
  const parents = new Set(chapters.map(c => c.parentId));
  return chapters.filter(c => !parents.has(c.id));
}
export function completion(course: LearningCourse) {
  const units = leaves(course.chapters), done = units.filter(c => c.completed).length;
  return { done, total: units.length, percent: units.length ? Math.round(done / units.length * 100) : 0 };
}
export function moveBranch(chapters: Chapter[], id: string, offset: number): Chapter[] {
  const item = chapters.find(c => c.id === id)!;
  const siblings = chapters.filter(c => c.parentId === item.parentId);
  const target = siblings[siblings.findIndex(c => c.id === id) + offset];
  if (!target) return chapters;
  const branch = descendants(chapters, id), ids = new Set(branch.map(c => c.id));
  const remaining = orderedChapters(chapters).filter(c => !ids.has(c.id));
  const targetIds = new Set(descendants(remaining, target.id).map(c => c.id));
  const insertion = offset < 0 ? remaining.findIndex(c => c.id === target.id) : remaining.reduce((last,c,i) => targetIds.has(c.id) ? i + 1 : last, 0);
  remaining.splice(insertion, 0, ...orderedChapters(branch.map(c => c.id === id ? { ...c, parentId: undefined } : c)).map(c => c.id === id ? item : c));
  return remaining;
}
