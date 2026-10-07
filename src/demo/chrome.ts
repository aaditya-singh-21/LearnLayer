import { catalogKey, reduceCatalog, validateCourse, type CatalogAction } from '../storage/catalog';
import { annotationKey, reduceAnnotation, type AnnotationAction } from '../storage/annotations';
import { editProgressWrites } from '../storage/progress';
// Only ordinary browser previews use this shim. Installed extension pages use real APIs.
export function installPreviewChrome() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) return;
  const listeners = new Set<(changes: Record<string,unknown>, area: string) => void>();
  const storage = {
    get: async (keys: string[] | null) => Object.fromEntries((keys || Object.keys(localStorage)).map(k => { const raw=localStorage.getItem(k); return [k,raw === null ? undefined : JSON.parse(raw)]; })),
    set: async (values: Record<string,unknown>) => {
      const changes = Object.fromEntries(Object.entries(values).map(([key,value]) => { const oldValue=JSON.parse(localStorage.getItem(key)||'null'); localStorage.setItem(key,JSON.stringify(value)); return [key,{oldValue,newValue:value}]; }));
      listeners.forEach(fn => fn(changes,'local'));
    },
  };
  window.addEventListener('storage',event => { const key = event.key; if(key) listeners.forEach(fn => fn({[key]:{newValue:event.newValue ? JSON.parse(event.newValue) : undefined}},'local')); });
  let queue: Promise<unknown> = Promise.resolve();
  Object.assign(window,{ chrome:{ storage:{local:storage,onChanged:{addListener:(fn:typeof listeners extends Set<infer F> ? F : never)=>listeners.add(fn),removeListener:(fn:typeof listeners extends Set<infer F> ? F : never)=>listeners.delete(fn)}},
    runtime:{getURL:(url:string)=>url,sendMessage:(message:{type:string;action:CatalogAction | AnnotationAction})=> {
      const response=queue.then(async()=> {
      if(message.type==='LL_DASHBOARD') { window.open('dashboard.html','_blank');return {ok:true}; }
      if(message.type==='LL_ANNOTATION') { const action=message.action as AnnotationAction, key=annotationKey(action.courseId,action.chapterId); const prior=(await storage.get([key]))[key]; await storage.set({[key]:reduceAnnotation(prior,action)});return {ok:true}; }
      if(message.type==='LL_CATALOG') { const catalog=(await storage.get([catalogKey]))[catalogKey] || {}; const action=message.action as CatalogAction; action.course=validateCourse(action.course,catalog[action.course.id]?.course); const progress=action.type === 'edit' ? await editProgressWrites(catalog[action.course.id]?.course,action.course) : {}; await storage.set({[catalogKey]:reduceCatalog(catalog,action),...progress});return {ok:true}; }
      return {ok:false};
      });
      queue=response.catch(()=>{});
      return response.catch(error=>({ok:false,error:error instanceof Error ? error.message : 'Could not save.'}));
    }},tabs:{create:async({url}:{url:string})=>{ window.open(url,'_blank'); }} }});
}
