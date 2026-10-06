export type Chapter = { id: string; title: string; url?: string; completed: boolean };
export type LearningCourse = { id: string; title: string; sourceUrl: string; chapters: Chapter[]; kind: 'navigation' | 'headings' };
export type DetectionCandidate = { course: LearningCourse; detectorId: string; reasons: string[]; score: number };
export type DetectionReport = { status: 'detected' | 'ambiguous' | 'unsupported'; candidates: DetectionCandidate[]; selected?: DetectionCandidate };
export type PageSnapshot = { course: LearningCourse | null; currentUrl: string; reachedEnd: boolean; detection?: DetectionReport; editRequested?: boolean };
export type CourseRecord = { version: 2; course: LearningCourse; originalId: string; corrected: boolean; membership: 'saved' | 'recent' | null; lastVisitedUrl?: string; preferredPages?: string[]; activity: number };
