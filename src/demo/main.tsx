// Browser-only demo. The shipped extension always uses chrome.storage.local.
import { createRoot } from 'react-dom/client';
import { Panel } from '../components/Panel';
import { detectLearningStructure } from '../detection/detect';
import { useState } from 'react';
import '../components/panel.css';
import './demo.css';
const listeners = new Set<(changes: unknown, area: string) => void>();
const demoStorage = {
  get: async (keys: string[]) => Object.fromEntries(keys.map(k => [k, JSON.parse(localStorage.getItem(k) || 'null')])),
  set: async (values: Record<string, unknown>) => { for (const [key,value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value)); listeners.forEach(fn => fn(values, 'local')); }
};
Object.assign(window, { chrome: { storage: { local: demoStorage, onChanged: { addListener: (fn: (changes: unknown, area: string) => void) => listeners.add(fn), removeListener: (fn: (changes: unknown, area: string) => void) => listeners.delete(fn) } } } });
const titles = ['Scale from Zero to Millions of Users','Back-of-the-Envelope Estimation','A Framework for System Design Interviews','Design a Rate Limiter','Design Consistent Hashing','Design a Key-Value Store','Design a URL Shortener'];
const doc = new DOMParser().parseFromString(`<a href="/system-design">System Design</a><nav aria-label="Chapters"><ul>${titles.map((t,i) => `<li><a href="/system-design/chapter-${i+1}">Chapter ${i+1}: ${t}</a></li>`).join('')}</ul></nav>`, 'text/html');
const course = detectLearningStructure(doc, 'https://demo.learnlayer.test/system-design/chapter-1');
function Demo() {
  const [url, setUrl] = useState(sessionStorage.getItem('ll:demo-url') || 'https://demo.learnlayer.test/system-design/chapter-1');
  const [unsupported, setUnsupported] = useState(false);
  return <main className="demo"><div className="demo-intro"><span>LEARNLAYER / INTERACTIVE PREVIEW</span><h1>Your learning.<br/>A layer of momentum.</h1><p>A small companion for the courses you already love.<br/>Check off a chapter. Pick up where you left off.</p><p className="demo-note">Demo course · local browser storage<br/>The Chrome extension uses chrome.storage.local.</p><button onClick={() => setUnsupported(!unsupported)}>{unsupported ? 'Show course' : 'Preview unsupported page'}</button></div><Panel snapshot={{ course: unsupported ? null : course, currentUrl: url, reachedEnd: false }} navigate={next => { sessionStorage.setItem('ll:demo-url', next); setUrl(next); }} /></main>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
