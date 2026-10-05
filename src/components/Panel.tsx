import { useEffect, useState } from 'react';
import type { LearningCourse, PageSnapshot } from '../types';
import { loadProgress, setCompleted } from '../storage/progress';
import { currentChapter, nextChapter } from '../utils/progress';
export function Panel({ snapshot, navigate, close, loading = false, error: externalError }: { snapshot: PageSnapshot; navigate: (url: string) => void; close?: () => void; loading?: boolean; error?: string }) {
  const [course, setCourse] = useState<LearningCourse | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'done'>('all');
  const [hintDismissed, setHintDismissed] = useState(false);
  const [reminders, setReminders] = useState(false);
  useEffect(() => {
    let active = true;
    const read = () => { void chrome.storage.local.get(['ll:reminders']).then(values => { if (active) setReminders(values['ll:reminders'] === true); }).catch(() => {}); };
    read();
    const listener = () => read(); chrome.storage.onChanged.addListener(listener);
    return () => { active = false; chrome.storage.onChanged.removeListener(listener); };
  }, []);
  useEffect(() => {
    let active = true;
    setCourse(null); setError('');
    async function refresh() {
      if (!snapshot.course) return;
      try { const loaded = await loadProgress(snapshot.course); if (active) setCourse(loaded); }
      catch { if (active) setError('Progress could not be loaded. Reopen the panel to retry.'); }
    }
    void refresh();
    const listener = (_changes: unknown, area: string) => { if (area === 'local') void refresh(); };
    chrome.storage.onChanged.addListener(listener);
    return () => { active = false; chrome.storage.onChanged.removeListener(listener); };
  }, [snapshot.course]);
  useEffect(() => setHintDismissed(false), [snapshot.currentUrl]);
  async function toggle(id: string, completed: boolean) {
    if (!course || saving) return;
    setSaving(true); setError('');
    try { await setCompleted(course.id, id, completed); setCourse(await loadProgress(course)); }
    catch { setError('Could not save progress. Please try again.'); }
    finally { setSaving(false); }
  }
  const current = course && currentChapter(course, snapshot.currentUrl);
  const next = course && nextChapter(course, snapshot.currentUrl);
  const done = course?.chapters.filter(c => c.completed).length || 0;
  const percent = course ? Math.round(done / course.chapters.length * 100) : 0;
  const busy = loading || (!!snapshot.course && !course && !error);
  return <section className="ll-panel" aria-label="LearnLayer learning progress">
    <header className="ll-header"><div className="ll-brand"><span className="ll-logo">L<span>↗</span></span><strong>LearnLayer</strong></div><div className="ll-header-right"><span className="ll-local"><i /> Local</span>{close && <button className="ll-close" onClick={close} aria-label="Close learning panel">×</button>}</div></header>
    {busy ? <div className="ll-empty"><div className="ll-empty-icon">⌕</div><h2>Finding your learning path</h2><p>Looking for chapters, lessons, and documentation.</p></div> : !course ? <div className="ll-empty"><div className="ll-empty-icon">⌕</div><span className="ll-eyebrow">A PLACE FOR YOUR PROGRESS</span><h2>No learning structure detected on this page.</h2><p>This page doesn't appear to contain a structured course or learning sequence.</p><p>Try opening a course, documentation, tutorial, or article series.</p></div> : <>
      <div className="ll-overview"><span className="ll-eyebrow">YOUR LEARNING PATH</span><h1>{course.title}</h1><div className="ll-source"><span>↗</span> {new URL(course.sourceUrl).hostname} <span className="ll-kind">{course.kind === 'headings' ? 'Page sections' : 'Course detected'}</span></div><div className="ll-progress-label"><span>{percent === 100 ? 'You did it. Keep building.' : 'A little progress, every day.'}</span><strong>{percent}<small>%</small></strong></div><div className="ll-progress" role="progressbar" aria-label="Course completion" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }} /></div><div className="ll-count"><strong>{done}</strong> of {course.chapters.length} chapters completed</div></div>
      {snapshot.reachedEnd && current && !current.completed && !hintDismissed && <div className="ll-hint"><button aria-label="Dismiss completion suggestion" onClick={() => setHintDismissed(true)}>×</button><strong>You've reached the end.</strong><p>Mark this chapter complete when you're ready.</p><button className="ll-hint-action" disabled={saving} onClick={() => void toggle(current.id, true)}>Mark as complete ✓</button></div>}
      <div className="ll-list-heading"><span>YOUR CHAPTERS <small>{course.chapters.length}</small></span><button onClick={() => setFilter(filter === 'all' ? 'done' : 'all')}>{filter === 'all' ? 'View completed' : 'View all'}</button></div>
      <ol className="ll-chapters">{course.chapters.filter(c => filter === 'all' || c.completed).map((chapter) => { const isCurrent = chapter.id === current?.id; const number = course.chapters.indexOf(chapter) + 1; return <li key={chapter.id} className={`${chapter.completed ? 'll-done' : ''} ${isCurrent ? 'll-current' : ''}`}><button className="ll-check" disabled={saving} aria-label={`${chapter.completed ? 'Mark incomplete' : 'Mark complete'}: ${chapter.title}`} aria-pressed={chapter.completed} onClick={() => void toggle(chapter.id, !chapter.completed)}>{chapter.completed ? '✓' : isCurrent ? '→' : <span />}</button><button className="ll-chapter-link" disabled={!chapter.url} onClick={() => chapter.url && navigate(chapter.url)}><span className="ll-chapter-meta">CHAPTER {String(number).padStart(2, '0')}{isCurrent && <em>→ Current</em>}</span><span className="ll-chapter-title">{chapter.title.replace(/^\s*(chapter|lesson|module|part)\s*\d+\s*[:.\-–]?\s*/i, '')}</span></button></li>; })}{filter === 'done' && !done && <li className="ll-filter-empty">Your completed chapters will appear here.</li>}</ol>
      <footer className="ll-footer">{current && !current.completed && <button className="ll-complete" disabled={saving} onClick={() => void toggle(current.id, true)}>{saving ? 'Saving…' : 'Mark current chapter complete'} <span>✓</span></button>}{next?.url ? <button className="ll-continue" onClick={() => navigate(next.url!)}><span>Continue learning</span><span>→</span></button> : <div className="ll-finished">{percent === 100 ? '✓ Learning path complete' : 'Check off chapters as you learn'}</div>}{next && <p className="ll-next">NEXT UP <span>{next.title.replace(/^Chapter\s*\d+:\s*/i, '')}</span></p>}</footer>
    </>}
    {(error || externalError) && <div className="ll-error" role="alert">{error || externalError}</div>}
    <div className="ll-bottom"><span>Your progress stays in this browser</span><button className="ll-reminders" aria-pressed={reminders} title="Suggest completion after 45 seconds of visible reading and reaching the page bottom" onClick={() => { void chrome.storage.local.set({ 'll:reminders': !reminders }).catch(() => setError('Could not save reminder preference.')); }}>Reminders {reminders ? 'on' : 'off'}</button></div>
  </section>;
}
