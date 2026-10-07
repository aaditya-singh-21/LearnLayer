import { useEffect, useRef, useState } from 'react';
import type { LearningCourse, PageSnapshot } from '../types';
import { loadProgress, setBranchCompleted } from '../storage/progress';
import { CourseEditor } from './CourseEditor';
import { mutateCatalog, readCatalog, resolveStored, storedDefinition, type CatalogAction } from '../storage/catalog';
import { currentChapter, nextChapter } from '../utils/progress';
import { ancestors, completion, orderedChapters, descendants } from '../utils/tree';
import { ChapterNotes } from './ChapterNotes';
import { readAnnotations, annotationKey, annotationPrefix, type Annotation } from '../storage/annotations';
export function Panel({ snapshot, navigate, close, openPanel, loading = false, error: externalError }: { snapshot: PageSnapshot; navigate: (url: string) => void; close?: () => void; openPanel?: (edit?: boolean) => void; loading?: boolean; error?: string }) {
  const [course, setCourse] = useState<LearningCourse | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(snapshot.editRequested === true);
  const [saved, setSaved] = useState(false);
  const [collapsed,setCollapsed] = useState<Set<string>>(new Set());
  const [notesId,setNotesId] = useState<string | null>(null);
  const [annotations,setAnnotations] = useState<Record<string,Annotation>>({});
  useEffect(() => {
    let active = true, generation = 0;
    async function refresh() { const ticket = ++generation; try { const notes = await readAnnotations(); if (active && ticket === generation) setAnnotations(notes); } catch { if (active) setError('Notes could not be loaded. Reopen the panel to retry.'); } }
    void refresh(); const listener = (changes:Record<string,unknown>,area:string) => { if (area === 'local' && Object.keys(changes).some(k => k.startsWith(annotationPrefix))) void refresh(); }; chrome.storage.onChanged.addListener(listener);
    return () => { active = false; chrome.storage.onChanged.removeListener(listener); };
  }, []);
  const [pendingMetadata, setPendingMetadata] = useState<CatalogAction | null>(null);
  const latestUrl = useRef(snapshot.currentUrl);
  latestUrl.current = snapshot.currentUrl;
  useEffect(() => { if (snapshot.editRequested) setEditing(true); }, [snapshot.editRequested]);
  useEffect(() => { if (!snapshot.editRequested) setEditing(false); setNotesId(null); }, [snapshot.currentUrl]);
  async function library() { try { const reply = await chrome.runtime.sendMessage({ type: 'LL_DASHBOARD' }); if (!reply?.ok) throw new Error(); } catch { setError('Could not open My learning. Please retry.'); } }
  function edit() { if (openPanel) openPanel(true); else setEditing(true); }
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'done' | 'bookmarked'>('all');
  const [hintDismissed, setHintDismissed] = useState(false);
  const [reminders, setReminders] = useState(false);
  const currentRow = useRef<HTMLLIElement>(null);
  const [jumpRequested, setJumpRequested] = useState(0);
  useEffect(() => {
    let active = true;
    const read = () => { void chrome.storage.local.get(['ll:reminders']).then(values => { if (active) setReminders(values['ll:reminders'] === true); }).catch(() => {}); };
    read();
    const listener = () => read(); chrome.storage.onChanged.addListener(listener);
    return () => { active = false; chrome.storage.onChanged.removeListener(listener); };
  }, []);
  useEffect(() => {
    let active = true;
    // Metadata refreshes for the same course must not unmount an unsaved note.
    setCourse(prior => prior?.id === snapshot.course?.id ? prior : null); setError('');
    let generation = 0;
    async function refresh() {
      const ticket = ++generation;
      if (!/^https?:/.test(snapshot.currentUrl)) return;
      try { const catalog = await readCatalog(); const matches = resolveStored(catalog,snapshot.currentUrl,snapshot.course); const resolved = matches.length === 1 ? storedDefinition(matches[0],snapshot.course) : matches.length > 1 ? null : snapshot.course; const loaded = resolved ? await loadProgress(resolved) : null; if (active && ticket === generation) { setCourse(loaded); setSaved(!!loaded && catalog[loaded.id]?.membership === 'saved'); } }
      catch { if (active && ticket === generation) setError('Progress could not be loaded. Reopen the panel to retry.'); }
    }
    void refresh();
    const listener = (_changes: unknown, area: string) => { if (area === 'local') void refresh(); };
    chrome.storage.onChanged.addListener(listener);
    return () => { active = false; chrome.storage.onChanged.removeListener(listener); };
  }, [snapshot.course, snapshot.currentUrl]);
  useEffect(() => setHintDismissed(false), [snapshot.currentUrl]);
  async function toggle(id: string, completed: boolean) {
    if (!course || saving) return;
    setSaving(true); setError('');
    const url = snapshot.currentUrl;
    try {
      await setBranchCompleted(course, id, completed);
      const loaded = await loadProgress(course);
      if (latestUrl.current === url) setCourse(loaded);
      const action: CatalogAction = { type: completed ? 'complete' : 'visit', course, url };
      try { await mutateCatalog(action); setPendingMetadata(null); }
      catch { setPendingMetadata(action); setError('Progress saved, but course history could not update. Retry below.'); }
    }
    catch { setError('Could not save progress. Please try again.'); }
    finally { setSaving(false); }
  }
  const current = course && currentChapter(course, snapshot.currentUrl);
  const next = course && nextChapter(course, snapshot.currentUrl);
  const { done,total,percent } = course ? completion(course) : {done:0,total:0,percent:0};
  const hierarchical = !!course?.chapters.some(c => c.parentId);
  const notesChapter = course?.chapters.find(c => c.id === notesId);
  const busy = loading || (!!snapshot.course && !course && !error);
  useEffect(() => {
    currentRow.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
  }, [current?.id, filter, jumpRequested]);
  return <section className="ll-panel" aria-label="LearnLayer learning progress">
    <header className="ll-header"><div className="ll-brand"><span className="ll-logo">L<span>↗</span></span><strong>LearnLayer</strong></div><div className="ll-header-right"><span className="ll-local"><i /> Local</span>{openPanel && <button className="ll-expand" onClick={() => openPanel(false)} aria-label="Open larger learning panel on this page" title="Open a larger panel on the page">↗</button>}{close && <button className="ll-close" onClick={close} aria-label="Close learning panel">×</button>}</div></header>
    <div className="ll-toolbar"><button onClick={() => void library()}>My learning ↗</button><button disabled={loading || !/^https?:/.test(snapshot.currentUrl)} onClick={edit}>{course ? 'Edit course' : 'Create course'}</button>{course && <button onClick={() => { void mutateCatalog({ type: saved ? 'unsave' : 'save', course, url: snapshot.currentUrl }).then(() => setSaved(!saved)).catch(() => setError('Could not save course. Please retry.')); }}>{saved ? 'Unsave' : 'Save course'}</button>}</div>
    {editing ? <CourseEditor course={course || snapshot.course} sourceUrl={snapshot.currentUrl} candidates={snapshot.detection?.candidates} onCancel={() => setEditing(false)} onSaved={updated => { setCourse(updated); setEditing(false); }} /> : notesChapter && course ? <ChapterNotes key={`${course.id}:${notesChapter.id}`} course={course} chapter={notesChapter} onClose={() => setNotesId(null)} /> : busy ? <div className="ll-empty"><div className="ll-empty-icon">⌕</div><h2>Finding your learning path</h2><p>Looking for chapters, lessons, and documentation.</p></div> : !course ? <div className="ll-empty"><div className="ll-empty-icon">⌕</div><span className="ll-eyebrow">A PLACE FOR YOUR PROGRESS</span><h2>{snapshot.detection?.status === 'ambiguous' ? 'Choose a learning structure' : 'No learning structure detected on this page.'}</h2><p>{snapshot.detection?.status === 'ambiguous' ? 'More than one structure looks plausible. Review the lists and choose the one you want to track.' : 'You can create a course using chapter links from this site.'}</p><p>Try opening a course, documentation, tutorial, or article series.</p>{!!snapshot.detection?.candidates.length && <button className="ll-complete" onClick={edit}>Review detected structures</button>}</div> : <>
      <div className="ll-overview"><h1>{course.title}</h1><div className="ll-source"><span>↗</span> {new URL(course.sourceUrl).hostname} <span className="ll-kind">{course.kind === 'headings' ? 'Page sections' : 'Course detected'}</span></div><div className="ll-progress-label"><span><b>{done}</b> of {total} {hierarchical ? 'topics' : 'chapters'} completed</span><strong>{percent}<small>%</small></strong></div><div className="ll-progress" role="progressbar" aria-label="Course completion" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }} /></div></div>
      {snapshot.reachedEnd && current && !current.completed && !hintDismissed && <div className="ll-hint"><button aria-label="Dismiss completion suggestion" onClick={() => setHintDismissed(true)}>×</button><strong>You've reached the end.</strong><p>Mark this chapter complete when you're ready.</p><button className="ll-hint-action" disabled={saving} onClick={() => void toggle(current.id, true)}>Mark as complete ✓</button></div>}
      <div className="ll-list-heading"><h2>Your chapters <small>{course.chapters.length}</small></h2><div className="ll-filters" role="group" aria-label="Filter chapters"><button aria-label="All chapters" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button><button aria-pressed={filter === 'done'} onClick={() => setFilter('done')}>Completed <span>{done}</span></button><button aria-pressed={filter === 'bookmarked'} onClick={() => setFilter('bookmarked')}>Bookmarks</button></div>{current && <button className="ll-jump" onClick={() => { setFilter('all'); setCollapsed(new Set()); setJumpRequested(n => n + 1); }}>↓ Current</button>}</div>
      <ol className="ll-chapters" aria-label="Chapters" tabIndex={0}>{orderedChapters(course.chapters).filter(c => filter === 'done' ? c.completed : filter === 'bookmarked' ? annotations[annotationKey(course.id,c.id)]?.bookmarked : !ancestors(course.chapters,c.id).some(id => collapsed.has(id))).map((chapter) => {
        const isCurrent = chapter.id === current?.id;
        const number = course.chapters.indexOf(chapter) + 1;
        const depth = ancestors(course.chapters,chapter.id).length;
        const children = course.chapters.filter(c => c.parentId === chapter.id);
        return <li key={chapter.id} ref={isCurrent ? currentRow : undefined} style={{ marginLeft: Math.min(depth,3) * 12 }} className={`${chapter.completed ? 'll-done' : ''} ${isCurrent ? 'll-current' : ''}`}>
          {hierarchical && <button className="ll-tree-toggle" aria-label={children.length ? (collapsed.has(chapter.id) ? 'Expand: ' : 'Collapse: ') + chapter.title : undefined} aria-expanded={children.length ? !collapsed.has(chapter.id) : undefined} disabled={!children.length || filter !== 'all'} onClick={() => setCollapsed(prior => { const next = new Set(prior); if (next.has(chapter.id)) next.delete(chapter.id); else next.add(chapter.id); return next; })}>{children.length ? collapsed.has(chapter.id) ? '▸' : '▾' : '·'}</button>}<button className="ll-check" disabled={saving} aria-label={`${chapter.completed ? 'Mark incomplete' : 'Mark complete'}: ${chapter.title}`} aria-pressed={chapter.completed} onClick={() => void toggle(chapter.id, !chapter.completed)}><span className="ll-check-indicator">{chapter.completed ? '✓' : String(number).padStart(2, '0')}</span></button>
          <button className="ll-chapter-link" disabled={!chapter.url} aria-current={isCurrent ? 'location' : undefined} onClick={() => chapter.url && navigate(chapter.url)}><span className="ll-chapter-title">{chapter.title.replace(/^\s*(chapter|lesson|module|part)\s*\d+\s*[:.\-–]?\s*/i, '')}</span>{children.length > 0 && <small className="ll-child-count">{completion({...course,chapters:descendants(course.chapters,chapter.id)}).done} / {completion({...course,chapters:descendants(course.chapters,chapter.id)}).total} topics</small>}{isCurrent && <span className="ll-current-label">→ Current</span>}</button>
          <button className="ll-topic-notes" aria-label={`Notes and bookmark: ${chapter.title}`} onClick={() => setNotesId(chapter.id)}>{annotations[annotationKey(course.id,chapter.id)]?.bookmarked ? '★' : annotations[annotationKey(course.id,chapter.id)]?.note ? '✎•' : '✎'}</button>
        </li>;
      })}{filter === 'bookmarked' && !course.chapters.some(c => annotations[annotationKey(course.id,c.id)]?.bookmarked) && <li className="ll-filter-empty">Bookmark a topic from its notes button to find it here.</li>}{filter === 'done' && !done && <li className="ll-filter-empty">Your completed chapters will appear here.</li>}</ol>
      <footer className="ll-footer"><div className="ll-actions">{current && !current.completed && <button className="ll-complete" aria-label="Mark current chapter complete" disabled={saving} onClick={() => void toggle(current.id, true)}>{saving ? 'Saving…' : 'Mark complete'} <span>✓</span></button>}{next?.url ? <button className="ll-continue" onClick={() => navigate(next.url!)}><span>Continue learning</span><span>→</span></button> : <div className="ll-finished">{percent === 100 ? '✓ Learning path complete' : 'Check off chapters as you learn'}</div>}</div>{next && <p className="ll-next">NEXT UP <span title={next.title}>{next.title.replace(/^Chapter\s*\d+:\s*/i, '')}</span></p>}</footer>
    </>}
    {(error || externalError) && <div className="ll-error" role="alert">{error || externalError}{pendingMetadata && <button onClick={() => { void mutateCatalog(pendingMetadata).then(() => { setPendingMetadata(null); setError(''); }).catch(() => setError('Course history could not update. Please retry.')); }}>Retry course history</button>}</div>}
    <div className="ll-bottom"><span>Your progress stays in this browser</span><button className="ll-reminders" aria-pressed={reminders} title="Suggest completion after 45 seconds of visible reading and reaching the page bottom" onClick={() => { void chrome.storage.local.set({ 'll:reminders': !reminders }).catch(() => setError('Could not save reminder preference.')); }}>Reminders {reminders ? 'on' : 'off'}</button></div>
  </section>;
}
