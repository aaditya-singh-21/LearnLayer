import type { Chapter, LearningCourse } from '../types';
import { canonicalUrl } from '../utils/identity';
export const annotationPrefix = 'll:v3:annotation:';
export type Annotation = { courseId: string; chapterId: string; courseTitle: string; title: string; url: string; note: string; bookmarked: boolean; updatedAt: number };
export type AnnotationAction = { courseId: string; chapterId: string; courseTitle: string; title: string; url: string; note?: string; bookmarked?: boolean };
export const annotationKey = (courseId: string, chapterId: string) => `${annotationPrefix}${courseId}:${chapterId}`;
export async function readAnnotations(): Promise<Record<string,Annotation>> {
  const all = await chrome.storage.local.get(null);
  return Object.fromEntries(Object.entries(all).filter(([key]) => key.startsWith(annotationPrefix))) as Record<string,Annotation>;
}
export function reduceAnnotation(prior: Annotation | undefined, action: AnnotationAction, now = Date.now()): Annotation {
  if (!action.courseId || !action.chapterId || !action.title?.trim() || !action.courseTitle?.trim()) throw new Error('Choose a chapter before saving.');
  const url = canonicalUrl(action.url);
  if (!/^https?:$/.test(new URL(url).protocol)) throw new Error('Use an HTTP or HTTPS chapter URL.');
  if (action.note !== undefined && (typeof action.note !== 'string' || action.note.length > 20000)) throw new Error('Keep notes under 20,000 characters.');
  if (action.bookmarked !== undefined && typeof action.bookmarked !== 'boolean') throw new Error('Invalid bookmark.');
  return { courseId:action.courseId, chapterId:action.chapterId, courseTitle:action.courseTitle, title:action.title, url,
    note:action.note ?? prior?.note ?? '', bookmarked:action.bookmarked ?? prior?.bookmarked ?? false, updatedAt:now };
}
export async function saveAnnotation(course: LearningCourse, chapter: Chapter, patch: { note?: string; bookmarked?: boolean }) {
  if (!chapter.url) throw new Error('This chapter needs a URL.');
  const action: AnnotationAction = { courseId:course.id, chapterId:chapter.id, courseTitle:course.title, title:chapter.title, url:chapter.url, ...patch };
  const response = await chrome.runtime.sendMessage({ type:'LL_ANNOTATION', action });
  if (!response?.ok) throw new Error(response?.error || 'Could not save. Please retry.');
}
