import { installPreviewChrome } from '../demo/chrome';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { readCatalog, mutateCatalog, type Catalog } from '../storage/catalog';
import { loadProgress } from '../storage/progress';
import type { CourseRecord, LearningCourse } from '../types';
import { CourseEditor } from '../components/CourseEditor';
import { currentChapter } from '../utils/progress';
import { completion } from '../utils/tree';
import { readAnnotations, type Annotation } from '../storage/annotations';
import { ChapterNotes } from '../components/ChapterNotes';
import { NotesLibrary } from './NotesLibrary';
import '../components/panel.css';
import './dashboard.css';
installPreviewChrome();
function Dashboard() {
  const [catalog,setCatalog] = useState<Catalog>({}), [search,setSearch] = useState(''), [error,setError] = useState(''), [loading,setLoading] = useState(true);
  const [editing,setEditing] = useState<LearningCourse | null>(null);
  const [annotations,setAnnotations] = useState<Annotation[]>([]), [topicSearch,setTopicSearch] = useState(''), [bookmarksOnly,setBookmarksOnly] = useState(false), [noteTarget,setNoteTarget] = useState<Annotation | null>(null);
  useEffect(() => {
    let active = true, generation = 0;
    async function refresh() {
      const ticket = ++generation;
      try { const [raw,notes] = await Promise.all([readCatalog(),readAnnotations()]); const records = await Promise.all(Object.values(raw).map(async r => ({ ...r, course: await loadProgress(r.course) }))); if (active && ticket === generation) { setCatalog(Object.fromEntries(records.map(r => [r.course.id,r]))); setAnnotations(Object.values(notes)); setError(''); } }
      catch { if (active) setError('Courses could not be loaded. Reload this tab to retry.'); }
      finally { if (active) setLoading(false); }
    }
    void refresh(); const listener = (_changes: unknown,area: string) => { if (area === 'local') void refresh(); }; chrome.storage.onChanged.addListener(listener);
    return () => { active=false; chrome.storage.onChanged.removeListener(listener); };
  },[]);
  async function changeMembership(record: CourseRecord) { try { await mutateCatalog({ type: record.membership === 'saved' ? 'unsave' : 'save', course:record.course }); } catch { setError('Could not update course. Please retry.'); } }
  async function resume(record: CourseRecord) { try { const last = record.lastVisitedUrl ? currentChapter(record.course,record.lastVisitedUrl) : undefined; await chrome.tabs.create({ url:last?.url || record.course.chapters[0]?.url || record.course.sourceUrl }); } catch { setError('Could not open the chapter. Please retry.'); } }
  function section(membership: 'saved' | 'recent') {
    const all = Object.values(catalog).filter(r => r.membership === membership).sort((a,b) => b.activity-a.activity);
    const visible = all.filter(r => `${r.course.title} ${new URL(r.course.sourceUrl).hostname}`.toLowerCase().includes(search.toLowerCase()));
    return <section><h2>{membership === 'saved' ? 'Saved courses' : 'Recent courses'} <small>{all.length}</small></h2>{!visible.length && <p className="empty">{search ? 'No courses match your search.' : membership === 'saved' ? 'Save a course to keep it here.' : 'Mark your first chapter complete to start your recent list. Your last five unsaved courses appear here.'}</p>}<div className="course-grid">{visible.map(r => {
      const {done,total,percent} = completion(r.course);
      const last = r.course.chapters.find(c => c.url === r.lastVisitedUrl);
      return <article key={r.course.id}><p className="site">{new URL(r.course.sourceUrl).hostname}</p><h3>{r.course.title}</h3><p>{done} / {total} {r.course.chapters.some(c => c.parentId) ? 'topics' : 'chapters'} <strong>{percent}%</strong></p><progress max={100} value={percent} aria-label={`${r.course.title} completion`} /><p className="last">Last visited: {last?.title || r.lastVisitedUrl || 'Not visited yet'}</p><div className="ll-tools"><button onClick={() => void resume(r)}>Resume ↗</button><button onClick={() => setEditing(r.course)}>Edit course</button><button onClick={() => void changeMembership(r)}>{membership === 'saved' ? 'Unsave' : 'Save course'}</button></div></article>;
    })}</div></section>;
  }
  return <main className="dashboard"><header><span className="brand">L↗ LearnLayer</span><span>Local to this browser</span></header><h1>My learning</h1><p>Pick up where you left off. Make space for what comes next.</p><label className="search">Search courses<input type="search" placeholder="Course title or website" value={search} onChange={e => setSearch(e.target.value)} /></label>{error && <p role="alert" className="ll-error">{error}</p>}{loading ? <p>Loading your courses…</p> : <>{section('saved')}{section('recent')}<NotesLibrary annotations={annotations.map(a => ({...a,courseTitle:catalog[a.courseId]?.course.title || a.courseTitle,title:catalog[a.courseId]?.course.chapters.find(c => c.id === a.chapterId)?.title || a.title}))} search={topicSearch} onSearch={setTopicSearch} bookmarksOnly={bookmarksOnly} onFilter={() => setBookmarksOnly(!bookmarksOnly)} onEdit={setNoteTarget} onError={setError} /></>}{editing && <div className="editor-backdrop"><section className="ll-panel dashboard-editor" aria-label="Edit course"><CourseEditor course={editing} sourceUrl={editing.sourceUrl} onCancel={() => setEditing(null)} onSaved={() => setEditing(null)} /></section></div>}{noteTarget && <div className="editor-backdrop"><section className="ll-panel dashboard-editor" aria-label="Topic notes"><ChapterNotes key={noteTarget.courseId + ':' + noteTarget.chapterId} course={catalog[noteTarget.courseId]?.course || {id:noteTarget.courseId,title:noteTarget.courseTitle,sourceUrl:noteTarget.url,kind:'navigation',chapters:[]}} chapter={catalog[noteTarget.courseId]?.course.chapters.find(c => c.id === noteTarget.chapterId) || {id:noteTarget.chapterId,title:noteTarget.title,url:noteTarget.url,completed:false}} onClose={() => setNoteTarget(null)} /></section></div>}<footer>Your progress stays in this browser. Your recent courses rotate; your progress stays saved.</footer></main>;
}
createRoot(document.getElementById('root')!).render(<Dashboard />);
