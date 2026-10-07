import { catalogKey, readCatalog, reduceCatalog, validateCourse, type CatalogAction } from '../storage/catalog';
import { annotationKey, reduceAnnotation, type AnnotationAction, type Annotation } from '../storage/annotations';
import { editProgressWrites } from '../storage/progress';
chrome.runtime.onInstalled.addListener(() => { void chrome.storage.local.set({ 'll:version': 3 }); });
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type === 'LL_DASHBOARD') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }).then(() => reply({ ok:true })).catch(() => reply({ ok:false }));
    return true;
  }
  if (message?.type !== 'LL_CATALOG' && message?.type !== 'LL_ANNOTATION') return;
  queue = queue.then(async () => {
    try {
      if (message.type === 'LL_ANNOTATION') {
        const action = message.action as AnnotationAction, key = annotationKey(action.courseId,action.chapterId);
        const prior = (await chrome.storage.local.get([key]))[key] as Annotation | undefined;
        await chrome.storage.local.set({ [key]:reduceAnnotation(prior,action) });
        reply({ ok:true }); return;
      }
      const action = message.action as CatalogAction;
      if (!['discover','save','unsave','edit','complete','visit'].includes(action.type)) throw new Error('Unknown course action.');
      const catalog = await readCatalog();
      action.course = validateCourse(action.course, catalog[action.course.id]?.course);
      const next = reduceCatalog(catalog, action);
      const writes: Record<string,unknown> = {};
      if (JSON.stringify(next) !== JSON.stringify(catalog)) writes[catalogKey] = next;
      if (action.type === 'edit') Object.assign(writes,await editProgressWrites(catalog[action.course.id]?.course,action.course));
      if (Object.keys(writes).length) await chrome.storage.local.set(writes);
      reply({ ok: true });
    } catch (error) { reply({ ok: false, error: error instanceof Error ? error.message : 'Could not save course.' }); }
  });
  return true;
});
