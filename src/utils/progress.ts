import type { LearningCourse } from '../types';
import { canonicalUrl, pageUrl } from './identity';
export function currentChapter(course: LearningCourse, url: string) {
  const exact = course.chapters.find(c => c.url && canonicalUrl(c.url) === canonicalUrl(url));
  return exact || course.chapters.find(c => c.url && !new URL(c.url).hash && pageUrl(c.url) === pageUrl(url));
}
export function nextChapter(course: LearningCourse, url: string) {
  const current = currentChapter(course, url);
  const index = course.chapters.findIndex(c => c.id === current?.id);
  return course.chapters.slice(index + 1).find(c => !c.completed) || course.chapters.find(c => !c.completed);
}
