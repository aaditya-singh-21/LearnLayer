import type { DetectedItem } from './normalize';
import { canonicalUrl, pageUrl } from '../utils/identity';

// Some readers encode chapter paths in a query value rather than the pathname.
// Match sibling routes on the current endpoint; never interpret arbitrary IDs
// or fetch a parent/linked page to infer additional chapters.
export function queryCurriculum(items: DetectedItem[], currentUrl: string) {
  const current = new URL(canonicalUrl(currentUrl));
  const groups: { items:DetectedItem[]; sourceUrl:string; path:string; numbered:number }[] = [];
  for (const [key,value] of current.searchParams) {
    const parts = value.split('/').filter(Boolean);
    if (parts.length < 2 || /^[a-z][a-z\d+.-]*:/i.test(value)) continue;
    const prefix = parts.slice(0,-1);
    const siblings = items.filter(item => {
      const url = new URL(item.url!);
      const route = url.searchParams.get(key)?.split('/').filter(Boolean);
      return url.pathname === current.pathname && route?.length === parts.length && prefix.every((part,i) => route[i] === part);
    });
    if (new Set(siblings.map(item => pageUrl(item.url!))).size < 3 || !siblings.some(item => pageUrl(item.url!) === pageUrl(currentUrl))) continue;
    const source = new URL(current.origin + current.pathname);
    // Keep constant scope parameters (e.g. language), omit varying view state.
    const first = new URL(siblings[0].url!);
    for (const [other,param] of first.searchParams) {
      if (other !== key && siblings.every(item => new URL(item.url!).searchParams.get(other) === param)) source.searchParams.set(other,param);
    }
    source.searchParams.set(key,prefix.join('/'));
    groups.push({items:siblings,sourceUrl:canonicalUrl(source.href),path:prefix.join('/'),numbered:siblings.filter(item => /^\d+[._-]\S/.test(new URL(item.url!).searchParams.get(key)!.split('/').filter(Boolean).at(-1)!)).length});
  }
  // Two independently plausible route parameters need normal candidate review;
  // this helper must not silently choose one merely by parameter order.
  return groups;
}
