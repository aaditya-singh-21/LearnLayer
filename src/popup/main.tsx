import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import type { PageSnapshot } from '../types';
import '../components/panel.css';
import './popup.css';
function Popup() {
  const [snapshot, setSnapshot] = useState<PageSnapshot>({ course: null, currentUrl: '', reachedEnd: false });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [tabId, setTabId] = useState<number>();
  useEffect(() => { void (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); setTabId(tab?.id);
      if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) { setError('Open an HTTP or HTTPS website to use LearnLayer.'); return; }
      setSnapshot({ course: null, currentUrl: tab.url, reachedEnd: false });
      let page: PageSnapshot;
      try { page = await chrome.tabs.sendMessage(tab.id, { type: 'LL_SNAPSHOT' }); }
      catch { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); page = await chrome.tabs.sendMessage(tab.id, { type: 'LL_SNAPSHOT' }); }
      setSnapshot(page);
    } catch { setError('This page cannot be inspected. Refresh it and reopen LearnLayer.'); }
    finally { setLoading(false); }
  })(); }, []);
  return <Panel snapshot={snapshot} loading={loading} error={error} openPanel={tabId && /^https?:/.test(snapshot.currentUrl) ? (edit = false) => { void chrome.tabs.sendMessage(tabId, { type: 'LL_OPEN_PANEL', edit }).then(() => window.close()).catch(() => setError('Could not open the page panel. Refresh the page and try again.')); } : undefined} navigate={url => { if (tabId) void chrome.tabs.update(tabId, { url }).then(() => window.close()); }} />;
}
createRoot(document.getElementById('root')!).render(<Popup />);
