export function stableId(value: string): string {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}
export function canonicalUrl(value: string, base?: string): string {
  const url = new URL(value, base);
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/$/, '') || '/';
  return url.href;
}
export function pageUrl(value: string): string { const url = new URL(canonicalUrl(value)); url.hash = ''; return url.href; }
