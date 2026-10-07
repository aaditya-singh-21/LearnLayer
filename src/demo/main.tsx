// Browser-only demo. The shipped extension always uses chrome.storage.local.
import { createRoot } from 'react-dom/client';
import { Panel } from '../components/Panel';
import { detectLearningStructure } from '../detection/detect';
import { installPreviewChrome } from './chrome';
import { useState } from 'react';
import '../components/panel.css';
import './demo.css';
installPreviewChrome();
const titles = ['Scale from Zero to Millions of Users','Back-of-the-Envelope Estimation','A Framework for System Design Interviews','Design a Rate Limiter','Design Consistent Hashing','Design a Key-Value Store','Design a URL Shortener'];
const doc = new DOMParser().parseFromString(`<a href="/system-design">System Design</a><nav aria-label="Chapters"><ul>${titles.map((t,i) => `<li><a href="/system-design/chapter-${i+1}">Chapter ${i+1}: ${t}</a>${i<2 ? `<ul><li><a href="/system-design/chapter-${i+1}#overview">${i+1}.1. Overview</a></li><li><a href="/system-design/chapter-${i+1}#practice">${i+1}.2. Practice</a></li></ul>` : ''}</li>`).join('')}</ul></nav>`, 'text/html');
const course = detectLearningStructure(doc, 'https://demo.learnlayer.test/system-design/chapter-1');
function Demo() {
  const [url, setUrl] = useState(sessionStorage.getItem('ll:demo-url') || 'https://demo.learnlayer.test/system-design/chapter-1');
  const [unsupported, setUnsupported] = useState(false);
  return <main className="demo"><div className="demo-intro"><span>LEARNLAYER / INTERACTIVE PREVIEW</span><h1>Your learning.<br/>A layer of momentum.</h1><p>A small companion for the courses you already love.<br/>Check off a chapter. Pick up where you left off.</p><p className="demo-note">Demo course · local browser storage<br/>The Chrome extension uses chrome.storage.local.</p><button onClick={() => setUnsupported(!unsupported)}>{unsupported ? 'Show course' : 'Preview unsupported page'}</button></div><Panel snapshot={{ course: unsupported ? null : course, currentUrl: url, reachedEnd: false }} navigate={next => { sessionStorage.setItem('ll:demo-url', next); setUrl(next); }} /></main>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
