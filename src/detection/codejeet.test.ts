// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { detectLearningStructure } from './detect';
import { currentChapter } from '../utils/progress';
// Chapter text/hrefs inspected from CodeJeet's rendered DOM on 2026-10-05.
const chapters = [
  ['Scale from Zero to Millions of Users','scale-from-zero-to-millions-of-users'],
  ['Back-of-the-Envelope Estimation','back-of-the-envelope-estimation'],
  ['A Framework for System Design Interviews','a-framework-for-system-design-interviews'],
  ['Design a Rate Limiter','design-a-rate-limiter'],
  ['Design Consistent Hashing','design-consistent-hashing'],
  ['Design a Key-Value Store','design-a-key-value-store'],
  ['Design a Unique ID Generator in Distributed Systems','design-a-unique-id-generator-in-distributed-systems'],
  ['Design a URL Shortener','design-a-url-shortner'],
  ['Design a Web Crawler','design-a-web-crawler'],
  ['Design a Notification System','design-a-notification-system'],
  ['Design a News Feed System','design-a-news-feed-system'],
  ['Design a Chat System','design-a-chat-system'],
  ['Design a Search Autocomplete System','design-a-search-autocomplete-system'],
  ['Design YouTube','design-youtube'], ['Design Google Drive','design-google-drive'], ['Proximity Service','proximity-service']
];
it('detects all 16 CodeJeet chapters and preserves identity on chapter navigation', () => {
  const nav = `<nav aria-label="Chapters"><ul>${chapters.map(([title,slug],i) => `<li><a href="/system-design/${slug}">Chapter ${i+1}: ${title}</a></li>`).join('')}</ul></nav>`;
  const doc = new DOMParser().parseFromString(`<a href="/system-design">System Design</a>${nav}<aside hidden>${nav}</aside><nav aria-label="Table of contents"><a href="#introduction">Introduction</a><a href="#setup">Setup</a><a href="#end">Conclusion</a></nav>`, 'text/html');
  const first = detectLearningStructure(doc, 'https://codejeet.com/system-design/scale-from-zero-to-millions-of-users')!;
  const fourth = detectLearningStructure(doc, 'https://codejeet.com/system-design/design-a-rate-limiter')!;
  expect(first.chapters).toHaveLength(16); expect(first.title).toBe('System Design'); expect(fourth.id).toBe(first.id);
  expect(currentChapter(fourth,'https://codejeet.com/system-design/design-a-rate-limiter')?.title).toBe('Chapter 4: Design a Rate Limiter');
});
