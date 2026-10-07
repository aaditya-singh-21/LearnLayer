import { useEffect, useRef, useState } from 'react';
import type { Chapter, LearningCourse } from '../types';
import { annotationKey, readAnnotations, saveAnnotation } from '../storage/annotations';
export function ChapterNotes({ course, chapter, onClose }: { course:LearningCourse; chapter:Chapter; onClose:()=>void }) {
  const [note,setNote] = useState(''), [baseline,setBaseline] = useState(''), [bookmarked,setBookmarked] = useState(false);
  const [error,setError] = useState(''), [saving,setSaving] = useState(false), [ready,setReady] = useState(false), [conflict,setConflict] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const dirty = useRef(false), draft = useRef(''), savedNote = useRef('');
  draft.current = note; savedNote.current = baseline; dirty.current = note !== baseline;
  useEffect(() => {
    const root = editor.current?.getRootNode();
    const prior = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
    return () => { if (prior instanceof HTMLElement && prior.isConnected) prior.focus(); };
  }, []);
  useEffect(() => { if (ready) editor.current?.querySelector('textarea')?.focus(); }, [ready]);
  useEffect(() => {
    let active = true, generation = 0;
    async function refresh() {
      const ticket = ++generation;
      try {
        const value = (await readAnnotations())[annotationKey(course.id,chapter.id)];
        if (!active || ticket !== generation) return;
        const incoming = value?.note || '';
        setBookmarked(value?.bookmarked || false); setReady(true);
        if (!dirty.current) { setNote(incoming); setBaseline(incoming); }
        else if (incoming !== draft.current && incoming !== savedNote.current) setConflict(true);
      } catch { if (active) setError('Notes could not be loaded. Close and reopen to retry.'); }
    }
    void refresh();
    const listener = (changes: Record<string,unknown>, area:string) => { if (area === 'local' && changes[annotationKey(course.id,chapter.id)]) void refresh(); };
    chrome.storage.onChanged.addListener(listener);
    return () => { active = false; chrome.storage.onChanged.removeListener(listener); };
  }, [course.id,chapter.id]);
  async function save() {
    setSaving(true); setError('');
    try { await saveAnnotation(course,chapter,{note}); dirty.current = false; setBaseline(note); setConflict(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save your note. Retry.'); }
    finally { setSaving(false); }
  }
  async function bookmark() {
    setSaving(true); setError('');
    try { await saveAnnotation(course,chapter,{bookmarked:!bookmarked}); setBookmarked(!bookmarked); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save bookmark. Retry.'); }
    finally { setSaving(false); }
  }
  return <div ref={editor} className="ll-editor ll-notes"><h2>Notes &amp; bookmark</h2><p>{chapter.title}</p>
    <button disabled={!ready || saving} aria-pressed={bookmarked} onClick={() => void bookmark()}>{bookmarked ? '★ Bookmarked — remove' : '☆ Bookmark this topic'}</button>
    <label>Your note<textarea aria-label="Your note" rows={9} maxLength={20000} disabled={!ready || saving} value={note} onChange={e => setNote(e.target.value)} placeholder="What did you learn? What needs another look?" /></label>
    <p>{note.length.toLocaleString()} / 20,000 characters · {note !== baseline ? 'Unsaved changes' : 'Saved locally'}</p>
    {conflict && <p role="status">This note changed in another tab. Your draft is kept; saving will replace the stored note.</p>}
    {error && <p className="ll-error" role="alert">{error}</p>}
    <div className="ll-tools"><button disabled={!ready || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save note'}</button><button disabled={saving} onClick={onClose}>{note !== baseline ? 'Discard draft & close' : 'Close notes'}</button></div>
  </div>;
}
