import { catalogKey, readCatalog, reduceCatalog, validateCourse, type CatalogAction } from '../storage/catalog';
chrome.runtime.onInstalled.addListener(() => { void chrome.storage.local.set({ 'll:version': 2 }); });
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type === 'LL_DASHBOARD') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }).then(() => reply({ ok:true })).catch(() => reply({ ok:false }));
    return true;
  }
  if (message?.type !== 'LL_CATALOG') return;
  queue = queue.then(async () => {
    try {
      const action = message.action as CatalogAction;
      if (!['discover','save','unsave','edit','complete','visit'].includes(action.type)) throw new Error('Unknown course action.');
      const catalog = await readCatalog();
      action.course = validateCourse(action.course, catalog[action.course.id]?.course);
      const next = reduceCatalog(catalog, action);
      if (JSON.stringify(next) !== JSON.stringify(catalog)) await chrome.storage.local.set({ [catalogKey]: next });
      reply({ ok: true });
    } catch (error) { reply({ ok: false, error: error instanceof Error ? error.message : 'Could not save course.' }); }
  });
  return true;
});
