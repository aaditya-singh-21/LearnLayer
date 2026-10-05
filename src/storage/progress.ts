import type { LearningCourse } from '../types';
export const progressKey = (courseId: string, chapterId: string) => `ll:v1:${courseId}:${chapterId}`;
export async function loadProgress(course: LearningCourse): Promise<LearningCourse> {
  const values = await chrome.storage.local.get(course.chapters.map(c => progressKey(course.id, c.id)));
  return { ...course, chapters: course.chapters.map(c => ({ ...c, completed: values[progressKey(course.id, c.id)] === true })) };
}
export async function setCompleted(courseId: string, chapterId: string, completed: boolean) {
  // Each chapter has its own key: concurrent changes in two tabs cannot overwrite each other.
  await chrome.storage.local.set({ [progressKey(courseId, chapterId)]: completed });
}
