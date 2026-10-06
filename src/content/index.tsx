import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import css from '../components/panel.css?inline';
import { detectLearningReport } from '../detection/detect';
import type { PageSnapshot } from '../types';
import { currentChapter } from '../utils/progress';
import { pageUrl } from '../utils/identity';
import { readCatalog, resolveStored, mutateCatalog, catalogKey, storedDefinition } from '../storage/catalog';
if (!document.getElementById('learnlayer-root')) {
  const host = document.createElement('div'); host.id = 'learnlayer-root';
  host.style.cssText = 'all:initial!important;position:fixed!important;z-index:2147483647!important;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = css; shadow.append(style);
  const mount = document.createElement('div'); shadow.append(mount); document.documentElement.append(host);
  const initial = detectLearningReport(document, location.href);
  let snapshot: PageSnapshot = { course: initial.selected?.course || null, detection: initial, currentUrl: location.href, reachedEnd: false };
  let elapsed = 0, priorUrl = location.href, generation = 0, lastVisit = '';
  let reminders = false;
  const subscribers = new Set<() => void>();
  const openSubscribers = new Set<(edit: boolean) => void>();
  function publish(updated: PageSnapshot) {
    if (JSON.stringify(updated) !== JSON.stringify(snapshot)) { snapshot = updated; subscribers.forEach(fn => fn()); }
  }
  function checkReminder() {
    const chapter = snapshot.course && currentChapter(snapshot.course, location.href);
    const root = document.scrollingElement || document.documentElement;
    const reachedEnd = reminders && !!chapter && elapsed >= 45 && root.scrollHeight > innerHeight * 1.2 && root.scrollTop + innerHeight >= root.scrollHeight - 120;
    publish({ ...snapshot, reachedEnd });
  }
  async function refresh() {
    const ticket = ++generation, url = location.href;
    if (priorUrl !== url) { elapsed = 0; priorUrl = url; }
    const detection = detectLearningReport(document, url);
    let course = detection.selected?.course || null;
    try {
      const catalog = await readCatalog();
      if (ticket !== generation || location.href !== url) return;
      const matches = resolveStored(catalog, url, course);
      if (matches.length === 1) course = storedDefinition(matches[0],course);
      else if (matches.length > 1) {
        course = null; detection.status = 'ambiguous'; delete detection.selected;
        detection.candidates = matches.map(r => ({ course: r.course, detectorId: 'stored-definition', score: 100, reasons: ['Previously tracked course contains this page'] }));
      }
      if (course && !catalog[course.id] && course.kind === 'navigation' &&
          new Set(course.chapters.map(c => c.url && pageUrl(c.url))).size >= 3) {
        // Retain the curriculum for chapter pages that only expose local
        // sections. This creates no Saved or Recent membership.
        await mutateCatalog({ type: 'discover', course });
      }
      if (course && catalog[course.id]?.membership && currentChapter(course,url)) {
        const visit = course.id + '|' + url;
        if (lastVisit !== visit) { lastVisit = visit; void mutateCatalog({ type: 'visit', course, url }).catch(() => { lastVisit = ''; }); }
      }
    } catch { /* The panel reports storage errors; DOM detection remains usable. */ }
    if (ticket !== generation || location.href !== url) return;
    publish({ course, detection, currentUrl: url, reachedEnd: false }); checkReminder();
  }
  void chrome.storage.local.get(['ll:reminders']).then(values => { reminders = values['ll:reminders'] === true; checkReminder(); }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['ll:reminders']) { reminders = changes['ll:reminders'].newValue === true; checkReminder(); }
    if (changes[catalogKey]) void refresh();
  });
  let debounce: ReturnType<typeof setTimeout>;
  new MutationObserver(records => {
    if (records.every(r => r.target === host || host.contains(r.target))) return;
    clearTimeout(debounce); debounce = setTimeout(() => void refresh(), 350);
  }).observe(document.body, { childList: true, subtree: true });
  setInterval(() => { if (document.visibilityState === 'visible') elapsed++; if (location.href !== priorUrl) void refresh(); else checkReminder(); }, 1000);
  window.addEventListener('hashchange', () => void refresh());
  window.addEventListener('scroll', checkReminder, { passive: true });
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message?.type === 'LL_SNAPSHOT') { void refresh().then(() => reply(snapshot)); return true; }
    if (message?.type === 'LL_OPEN_PANEL') { openSubscribers.forEach(fn => fn(message.edit === true)); reply({ opened: true }); }
  });
  function Layer() {
    const [page, setPage] = useState(snapshot), [open, setOpen] = useState(false), [edit, setEdit] = useState(false);
    useEffect(() => { const fn = () => setPage(snapshot); subscribers.add(fn); fn(); return () => { subscribers.delete(fn); }; }, []);
    useEffect(() => { const fn = (requested: boolean) => { setEdit(requested); setOpen(true); }; openSubscribers.add(fn); return () => { openSubscribers.delete(fn); }; }, []);
    useEffect(() => {
      if (!open) return;
      shadow.querySelector<HTMLButtonElement>('.ll-close')?.focus({ preventScroll: true });
      const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setEdit(false); } };
      document.addEventListener('keydown', listener);
      return () => { document.removeEventListener('keydown', listener); shadow.querySelector<HTMLButtonElement>('.ll-float')?.focus({ preventScroll: true }); };
    }, [open]);
    if (!page.course && !page.detection?.candidates.length && !open) return null;
    return <>{open && <div className="ll-overlay"><Panel snapshot={{ ...page, editRequested: edit }} close={() => { setOpen(false); setEdit(false); }} navigate={url => { location.href = url; }} /></div>}<button className="ll-float" aria-expanded={open} onClick={() => { setOpen(!open); setEdit(false); }}>◈ LearnLayer {open ? '×' : '↗'}</button></>;
  }
  createRoot(mount).render(<Layer />);
  void refresh();
}
