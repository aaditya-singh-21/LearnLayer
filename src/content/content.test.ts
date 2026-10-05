// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import type { PageSnapshot } from '../types';
it('production content bundle mounts isolated UI, replies to popup, and saves a chapter', async () => {
  document.body.innerHTML = '<a href="/system-design">System Design</a><nav aria-label="Chapters"><a href="/system-design/chapter-1">Chapter 1: Scale</a><a href="/system-design/chapter-2">Chapter 2: Estimate</a><a href="/system-design/chapter-3">Chapter 3: Design</a></nav>';
  window.history.replaceState({}, '', '/system-design/chapter-1');
  const disk: Record<string, unknown> = {};
  const listeners = new Set<(changes: Record<string,unknown>, area: string) => void>();
  let messageListener: (message: unknown, sender: unknown, reply: (page: PageSnapshot) => void) => void = () => {};
  vi.stubGlobal('chrome', { runtime: { onMessage: { addListener: (fn: typeof messageListener) => { messageListener = fn; } } }, storage: { local: { get: async (keys: string[]) => Object.fromEntries(keys.map(k => [k,disk[k]])), set: async (values: Record<string, unknown>) => { Object.assign(disk,values); const changes = Object.fromEntries(Object.entries(values).map(([k,v]) => [k,{newValue:v}])); listeners.forEach(fn => fn(changes,'local')); } }, onChanged: { addListener: (fn: (changes: Record<string,unknown>, area: string) => void) => listeners.add(fn), removeListener: (fn: (changes: Record<string,unknown>, area: string) => void) => listeners.delete(fn) } } });
  let tick: () => void = () => {};
  vi.spyOn(window, 'setInterval').mockImplementation((handler) => { tick = handler as () => void; return 1 as unknown as ReturnType<typeof window.setInterval>; });
  const code = readFileSync('dist/content.js', 'utf8');
  window.eval(code);
  const settle = () => new Promise(resolve => setTimeout(resolve, 80));
  await settle();
  const shadow = document.getElementById('learnlayer-root')!.shadowRoot!;
  expect(shadow.querySelector('style')?.textContent).toContain('.ll-panel');
  expect(shadow.querySelector('.ll-float')).not.toBeNull();
  let snapshot: PageSnapshot | undefined;
  messageListener({type:'LL_SNAPSHOT'}, {}, page => { snapshot = page; });
  expect(snapshot?.course?.chapters).toHaveLength(3);
  (shadow.querySelector('.ll-float') as HTMLButtonElement).click(); await settle();
  expect(shadow.textContent).toContain('System Design');
  expect(shadow.textContent).toContain('→ Current');
  (shadow.querySelector('.ll-complete') as HTMLButtonElement).click(); await settle();
  expect(Object.values(disk)).toContain(true);
  expect(shadow.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('33');
  expect(shadow.querySelector('.ll-complete')).toBeNull();
  (shadow.querySelector('.ll-check') as HTMLButtonElement).click(); await settle();
  Object.defineProperty(document.documentElement, 'scrollHeight', {value:2200, configurable:true});
  document.documentElement.scrollTop = 1600;
  for (let i=0;i<50;i++) tick(); await settle();
  expect(shadow.querySelector('.ll-hint')).toBeNull(); // Opt-in remains off.
  (shadow.querySelector('.ll-reminders') as HTMLButtonElement).click(); await settle();
  for (let i=0;i<5;i++) tick(); await settle();
  expect(shadow.querySelector('.ll-hint')).not.toBeNull();
  expect(shadow.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0'); // Suggestion never auto-completes.
  (shadow.querySelector('.ll-hint-action') as HTMLButtonElement).click(); await settle();
  expect(shadow.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('33');
  // Popup reinjection does not duplicate listeners or UI hosts.
  window.eval(code); expect(document.querySelectorAll('#learnlayer-root')).toHaveLength(1);
  (shadow.querySelector('.ll-close') as HTMLButtonElement).click(); await settle();
  expect(shadow.querySelector('.ll-panel')).toBeNull();
  vi.restoreAllMocks();
});
