import type { LearningCourse } from '../types';
import { canonicalUrl, pageUrl } from './identity';
import { leaves, orderedChapters, descendants } from './tree';
export function currentChapter(course: LearningCourse, url: string) {
  const exact = course.chapters.find(c => c.url && canonicalUrl(c.url) === canonicalUrl(url));
  return exact || course.chapters.find(c => c.url && !new URL(c.url).hash && pageUrl(c.url) === pageUrl(url));
}
export function nextChapter(course: LearningCourse, url: string) {
  const current = currentChapter(course, url);
  const ordered = orderedChapters(course.chapters), units = leaves(ordered);
  const children = current && leaves(descendants(ordered, current.id));
  if (children && children.length > 1) { const unfinished = children.find(c => !c.completed); if (unfinished) return unfinished; }
  const index = ordered.findIndex(c => c.id === current?.id);
  return units.find(c => !c.completed && ordered.indexOf(c) > index) || units.find(c => !c.completed);
}
