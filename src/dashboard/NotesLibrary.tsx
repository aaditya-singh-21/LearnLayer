import type { Annotation } from '../storage/annotations';
export function NotesLibrary({ annotations, search, onSearch, bookmarksOnly, onFilter, onEdit, onError }: {
  annotations:Annotation[]; search:string; onSearch:(value:string)=>void;
  bookmarksOnly:boolean; onFilter:()=>void; onEdit:(annotation:Annotation)=>void; onError:(error:string)=>void;
}) {
  const visible = annotations.filter(a => {
    const matches = `${a.note} ${a.title} ${a.courseTitle} ${new URL(a.url).hostname}`.toLowerCase().includes(search.toLowerCase());
    return (a.note || a.bookmarked) && (!bookmarksOnly || a.bookmarked) && matches;
  }).sort((a,b) => b.updatedAt-a.updatedAt);
  return <section className="learning-notes">
    <h2>Notes &amp; bookmarks</h2>
    <label className="search">Search notes and bookmarks<input type="search" placeholder="Note text, topic, course or website" value={search} onChange={e => onSearch(e.target.value)} /></label>
    <button aria-pressed={bookmarksOnly} onClick={onFilter}>{bookmarksOnly ? 'Showing bookmarks' : 'Show bookmarks only'}</button>
    <div className="course-grid">{visible.map(a => <article key={`${a.courseId}:${a.chapterId}`}>
      <p className="site">{a.courseTitle} · {new URL(a.url).hostname}</p>
      <h3>{a.bookmarked ? '★ ' : ''}{a.title}</h3>
      <p className="note-preview">{a.note || 'Bookmarked for another look.'}</p>
      <div className="ll-tools"><button onClick={() => { void chrome.tabs.create({url:a.url}).catch(() => onError('Could not open this topic. Retry.')); }}>Open topic ↗</button><button onClick={() => onEdit(a)}>Edit note &amp; bookmark</button></div>
    </article>)}</div>
    {!visible.length && <p className="empty">{search ? 'No notes or bookmarks match your search.' : 'Open a topic’s notes button in the learning panel to add a note or bookmark.'}</p>}
  </section>;
}
