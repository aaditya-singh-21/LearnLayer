export type Chapter = { id: string; title: string; url?: string; completed: boolean };
export type LearningCourse = { id: string; title: string; sourceUrl: string; chapters: Chapter[]; kind: 'navigation' | 'headings' };
export type PageSnapshot = { course: LearningCourse | null; currentUrl: string; reachedEnd: boolean };
