import { useEffect, useRef, useState } from 'react';
import type { DetectionCandidate, LearningCourse } from '../types';
import { mutateCatalog, validateCourse } from '../storage/catalog';
import { stableId, pageUrl } from '../utils/identity';
import { descendants, moveBranch, orderedChapters, ancestors } from '../utils/tree';
export function CourseEditor({ course, sourceUrl, candidates = [], onCancel, onSaved }: { course: LearningCourse | null; sourceUrl: string; candidates?: DetectionCandidate[]; onCancel: () => void; onSaved: (course: LearningCourse) => void }) {
  const [draft, setDraft] = useState<LearningCourse>(() => structuredClone(course || { id: stableId(`manual|${pageUrl(sourceUrl)}`), title: '', sourceUrl: pageUrl(sourceUrl), chapters: [], kind: 'navigation' }));
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [reset, setReset] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = editor.current;
    const prior = root?.getRootNode() instanceof ShadowRoot ? (root.getRootNode() as ShadowRoot).activeElement : document.activeElement;
    root?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { if (prior instanceof HTMLElement && prior.isConnected) prior.focus(); };
  }, []);
  function choose(candidate: LearningCourse) {
    const ids = new Map(candidate.chapters.map(c => [c.id,course?.chapters.find(s => s.url === c.url)?.id || c.id]));
    setDraft({ ...structuredClone(candidate), id: course?.id || candidate.id, chapters: candidate.chapters.map(c => ({ ...c, id:ids.get(c.id)!, ...(c.parentId ? {parentId:ids.get(c.parentId)} : {}) })) });
    setReset(true); setError('');
  }
  async function save() {
    setSaving(true); setError('');
    try { const valid = validateCourse(draft,course || undefined); await mutateCatalog({ type: 'edit', course: valid, corrected: true, url: sourceUrl }); onSaved(valid); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save changes. Retry.'); }
    finally { setSaving(false); }
  }
  function update(index: number, field: 'title' | 'url' | 'parentId', value: string) { setReset(false); setDraft({ ...draft, chapters: draft.chapters.map((c,i) => i === index ? { ...c, [field]: value || (field === 'parentId' ? undefined : '') } : c) }); }
  function move(index: number, offset: number) { setDraft({ ...draft, chapters:moveBranch(draft.chapters,draft.chapters[index].id,offset) }); setReset(false); }
  function add(parentId?: string) { setDraft({ ...draft, chapters:orderedChapters([...draft.chapters,{id:crypto.randomUUID(),title:'',url:'',completed:false,...(parentId ? {parentId} : {})}]) }); setReset(false); }
  return <div className="ll-editor" ref={editor}>
    <h2>{course ? 'Edit course' : 'Create course'}</h2><p>Changes stay in a draft until you save. Choose a parent to nest a topic. Removing a parent removes its subsections; their progress and notes stay stored.</p>
    {candidates.length > 0 && <details><summary>{course ? 'Reset to detected structure / choose another list' : 'Choose a learning structure'}</summary>{candidates.map((c,i) => <div className="ll-candidate" key={`${c.detectorId}-${i}`}><strong>{c.course.title}</strong><p>{c.reasons.join(' · ')} · {c.course.chapters.length} chapters</p><ol>{c.course.chapters.slice(0,5).map(ch => <li key={ch.id}>{ch.title}</li>)}</ol><button disabled={saving} onClick={() => choose(c.course)}>Preview this structure</button></div>)}</details>}
    {reset && <p role="status">Previewing detected structure. Save changes to apply it.</p>}
    <fieldset disabled={saving}><label>Course title<input value={draft.title} onChange={e => { setDraft({ ...draft, title:e.target.value }); setReset(false); }} /></label>
    {draft.chapters.map((c,i) => <div className="ll-edit-row" key={c.id} style={{marginLeft:Math.min(ancestors(draft.chapters,c.id).length,3)*12}}><label>Chapter {i+1} title<input value={c.title} onChange={e => update(i,'title',e.target.value)} /></label><label>Chapter {i+1} URL<input value={c.url || ''} onChange={e => update(i,'url',e.target.value)} /></label><label>Parent of chapter {i+1}<select value={c.parentId || ''} onChange={e => update(i,'parentId',e.target.value)}><option value="">Top-level chapter</option>{draft.chapters.filter(p => !descendants(draft.chapters,c.id).some(child => child.id === p.id)).map(p => <option key={p.id} value={p.id}>{p.title || 'Untitled chapter'}</option>)}</select></label><div className="ll-tools"><button disabled={draft.chapters.filter(s => s.parentId === c.parentId)[0]?.id === c.id} onClick={() => move(i,-1)} aria-label={`Move chapter ${i+1} up`}>↑ Up</button><button disabled={draft.chapters.filter(s => s.parentId === c.parentId).at(-1)?.id === c.id} onClick={() => move(i,1)} aria-label={`Move chapter ${i+1} down`}>↓ Down</button><button onClick={() => { setDraft({ ...draft, chapters:draft.chapters.filter(ch => !descendants(draft.chapters,c.id).some(child => child.id === ch.id)) }); setReset(false); }}>Remove</button><button disabled={draft.chapters.length>=150} onClick={() => add(c.id)}>+ Add subsection</button></div></div>)}
    <button disabled={draft.chapters.length>=150} onClick={() => add()}>+ Add chapter</button></fieldset>
    {error && <p className="ll-error" role="alert">{error}</p>}<div className="ll-tools"><button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</button><button disabled={saving} onClick={onCancel}>Cancel</button></div>
  </div>;
}
