import type { LearningCourse } from '../types';
import { ancestors, descendants, orderedChapters } from '../utils/tree';
export const progressKey = (courseId: string, chapterId: string) => `ll:v1:${courseId}:${chapterId}`;
export async function loadProgress(course: LearningCourse): Promise<LearningCourse> {
  const values = await chrome.storage.local.get(course.chapters.map(c => progressKey(course.id, c.id)));
  const chapters = course.chapters.map(c => {
    const own = values[progressKey(course.id, c.id)];
    // Missing child flags inherit legacy chapter completion. Explicit false wins.
    const nearest = ancestors(course.chapters, c.id).map(id => values[progressKey(course.id, id)]).find(v => typeof v === 'boolean');
    return { ...c, completed: typeof own === 'boolean' ? own : nearest === true };
  });
  for (const c of [...orderedChapters(chapters)].reverse()) {
    const children = chapters.filter(child => child.parentId === c.id);
    if (children.length) c.completed = children.every(child => child.completed);
  }
  return { ...course, chapters };
}
export async function setBranchCompleted(course: LearningCourse, chapterId: string, completed: boolean) {
  // A branch operation is one atomic write; unrelated chapter keys stay independent.
  const branch = descendants(course.chapters, chapterId);
  await chrome.storage.local.set(Object.fromEntries(branch.map(c => [progressKey(course.id, c.id), completed])));
}
export async function setCompleted(courseId: string, chapterId: string, completed: boolean) {
  // Each chapter has its own key: concurrent changes in two tabs cannot overwrite each other.
  await chrome.storage.local.set({ [progressKey(courseId, chapterId)]: completed });
}
export async function editProgressWrites(previous: LearningCourse | undefined, next: LearningCourse): Promise<Record<string,boolean>> {
  const loaded = previous ? await loadProgress(previous) : undefined;
  const keys = [...new Set([...(previous?.chapters || []),...next.chapters].map(c => progressKey(next.id,c.id)))];
  const flags = await chrome.storage.local.get(keys), writes: Record<string,boolean> = {};
  // Materialize inherited history before its previous tree relationship changes.
  for (const c of loaded?.chapters || []) {
    const key = progressKey(next.id,c.id);
    if (flags[key] === undefined) writes[key] = c.completed;
  }
  for (const c of next.chapters) {
    const key = progressKey(next.id,c.id);
    if (flags[key] === undefined && !(key in writes)) writes[key] = false;
  }
  return writes;
}
