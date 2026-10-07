import type { DetectionCandidate, DetectionReport, LearningCourse } from '../types';
import { navigationCandidates } from './navigation';
import { headingCandidates } from './headings';
import { canonicalUrl } from '../utils/identity';
import { detectionPolicy } from './policy';
export { detectionPolicy } from './policy';
export interface StructureDetector { id: string; detect: (doc: Document, url: string, navigation: DetectionCandidate[]) => DetectionCandidate[] }
export const detectors: StructureDetector[] = [
  { id: 'curriculum-navigation', detect: (_doc,_url,navigation) => navigation.filter(c => c.detectorId === 'curriculum-navigation') },
  { id: 'documentation-navigation', detect: (_doc,_url,navigation) => navigation.filter(c => c.detectorId === 'documentation-navigation') },
  { id: 'anchored-sections', detect: headingCandidates },
];
export function detectLearningReport(doc: Document, currentUrl: string): DetectionReport {
  const seen = new Set<string>();
  // Scan navigation once; both navigation detectors share its extraction.
  const extracted = navigationCandidates(doc, currentUrl);
  const candidates = detectors.flatMap(detector => detector.detect(doc,currentUrl,extracted)).sort((a,b) => b.score - a.score || b.course.chapters.filter(c => c.parentId).length - a.course.chapters.filter(c => c.parentId).length).filter(candidate => {
    const fingerprint = candidate.course.chapters.map(c => canonicalUrl(c.url!)).sort().join('|');
    if (seen.has(fingerprint)) return false; seen.add(fingerprint); return true;
  });
  const first = candidates[0];
  if (!first) return { status: 'unsupported', candidates };
  // Structural validation already filters ordinary menus. A sole candidate
  // needs no choice screen; the user can correct it through Edit course.
  if (candidates.length === 1) return { status: 'detected', candidates, selected: first };
  if (first.score < detectionPolicy.minimumScore) return { status: 'unsupported', candidates };
  const second = candidates[1];
  if (second && first.score - second.score < detectionPolicy.ambiguityMargin) return { status: 'ambiguous', candidates };
  return { status: 'detected', candidates, selected: first };
}
export function detectLearningStructure(doc: Document, currentUrl: string): LearningCourse | null {
  return detectLearningReport(doc,currentUrl).selected?.course || null;
}
