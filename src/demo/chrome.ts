import { catalogKey, reduceCatalog, type CatalogAction } from '../storage/catalog';
// Only ordinary browser previews use this shim. Installed extension pages use real APIs.
export function installPreviewChrome() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) return;
  const listeners = new Set<(changes: Record<string,unknown>, area: string) => void>();
  const storage = {
    get: async (keys: string[]) => Object.fromEntries(keys.map(k => [k,JSON.parse(localStorage.getItem(k) || 'null')])),
    set: async (values: Record<string,unknown>) => {
      const changes = Object.fromEntries(Object.entries(values).map(([key,value]) => { const oldValue=JSON.parse(localStorage.getItem(key)||'null'); localStorage.setItem(key,JSON.stringify(value)); return [key,{oldValue,newValue:value}]; }));
      listeners.forEach(fn => fn(changes,'local'));
    },
  };
  window.addEventListener('storage',event => { const key = event.key; if(key) listeners.forEach(fn => fn({[key]:{newValue:event.newValue ? JSON.parse(event.newValue) : undefined}},'local')); });
  Object.assign(window,{ chrome:{ storage:{local:storage,onChanged:{addListener:(fn:typeof listeners extends Set<infer F> ? F : never)=>listeners.add(fn),removeListener:(fn:typeof listeners extends Set<infer F> ? F : never)=>listeners.delete(fn)}},
    runtime:{getURL:(url:string)=>url,sendMessage:async(message:{type:string;action:CatalogAction})=> {
      if(message.type==='LL_DASHBOARD') { window.open('dashboard.html','_blank');return {ok:true}; }
      if(message.type==='LL_CATALOG') { const catalog=(await storage.get([catalogKey]))[catalogKey] || {}; await storage.set({[catalogKey]:reduceCatalog(catalog,message.action)});return {ok:true}; }
      return {ok:false};
    }},tabs:{create:async({url}:{url:string})=>{ window.open(url,'_blank'); }} }});
}
