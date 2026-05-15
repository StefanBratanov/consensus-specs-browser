// Tiny in-memory cache for raw GitHub source fetched on demand by the snippet
// viewer. Keyed by full URL so the same file at the same SHA is fetched once
// per session.

const cache = new Map<string, Promise<string>>();

export function fetchSource(url: string): Promise<string> {
  let p = cache.get(url);
  if (p) return p;
  p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
    return await res.text();
  })();
  cache.set(url, p);
  // If the fetch fails, evict so a manual retry can re-attempt.
  p.catch(() => cache.delete(url));
  return p;
}

export function buildRawUrl(template: string, sha: string, file: string): string {
  return template.replace('{sha}', sha).replace('{file}', file);
}
