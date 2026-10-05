import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import css from '../components/panel.css?inline';
import { detectLearningStructure } from '../detection/detect';
import type { PageSnapshot } from '../types';
import { currentChapter } from '../utils/progress';
if (!document.getElementById('learnlayer-root')) {
  const host = document.createElement('div'); host.id = 'learnlayer-root';
  host.style.cssText = 'all:initial!important;position:fixed!important;z-index:2147483647!important;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = css; shadow.append(style);
  const mount = document.createElement('div'); shadow.append(mount); document.documentElement.append(host);
  let snapshot: PageSnapshot = { course: detectLearningStructure(document, location.href), currentUrl: location.href, reachedEnd: false };
  let elapsed = 0, priorUrl = location.href;
  let reminders = false;
  void chrome.storage.local.get(['ll:reminders']).then(values => { reminders = values['ll:reminders'] === true; }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes['ll:reminders']) { reminders = changes['ll:reminders'].newValue === true; refresh(); } });
  const subscribers = new Set<() => void>();
  function refresh() {
    if (priorUrl !== location.href) { elapsed = 0; priorUrl = location.href; }
    const course = detectLearningStructure(document, location.href);
    const chapter = course && currentChapter(course, location.href);
    const root = document.scrollingElement || document.documentElement;
    const end = reminders && !!chapter && elapsed >= 45 && root.scrollHeight > innerHeight * 1.2 && root.scrollTop + innerHeight >= root.scrollHeight - 120;
    const updated = { course, currentUrl: location.href, reachedEnd: end };
    if (JSON.stringify(updated) !== JSON.stringify(snapshot)) { snapshot = updated; subscribers.forEach(fn => fn()); }
  }
  let debounce: ReturnType<typeof setTimeout>;
  new MutationObserver(() => { clearTimeout(debounce); debounce = setTimeout(refresh, 350); }).observe(document.body, { childList: true, subtree: true });
  setInterval(() => { if (document.visibilityState === 'visible') elapsed++; if (location.href !== priorUrl || elapsed % 5 === 0) refresh(); }, 1000);
  window.addEventListener('hashchange', refresh);
  window.addEventListener('scroll', () => { clearTimeout(debounce); debounce = setTimeout(refresh, 150); }, { passive: true });
  chrome.runtime.onMessage.addListener((message, _sender, reply) => { if (message?.type === 'LL_SNAPSHOT') { refresh(); reply(snapshot); } });
  function Layer() {
    const [page, setPage] = useState(snapshot), [open, setOpen] = useState(false);
    useEffect(() => { const fn = () => setPage(snapshot); subscribers.add(fn); return () => { subscribers.delete(fn); }; }, []);
    useEffect(() => { if (!open) return; const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener); }, [open]);
    if (!page.course && !open) return null;
    return <>{open && <div className="ll-overlay"><Panel snapshot={page} close={() => setOpen(false)} navigate={url => { location.href = url; }} /></div>}<button className="ll-float" aria-expanded={open} onClick={() => setOpen(!open)}>◈ LearnLayer {open ? '×' : '↗'}</button></>;
  }
  createRoot(mount).render(<Layer />);
}
