import { SnapshotSchema, type Snapshot, TekuYamlSchema, type SpecEntity, type ClientConfig, type SourceRef, type ClientImpl, TEKU_FILE_CATEGORY, CATEGORIES, type Category } from '../types/entity';
import bakedSnapshotData from '../data/snapshot.json';

export function loadBakedSnapshot(): Snapshot {
  return SnapshotSchema.parse(bakedSnapshotData);
}

/* ----------------------------------------------------------------------------
 * Runtime refresh — fetch the same YAML files live and rebuild the snapshot
 * in-memory. Line numbers are NOT resolved at runtime (too many requests).
 * The UI shows a small "search string" affordance instead of #L deep links
 * for any source ref refreshed live.
 * -------------------------------------------------------------------------- */

const SPEC_TAG_RE = /^\s*<spec\b([^>]*)>([\s\S]*?)<\/spec>\s*$/;
const ATTR_RE = /(\w+)\s*=\s*"([^"]*)"/g;

function parseSpecTag(raw: string): { body: string; attrs: Record<string, string> } {
  const m = raw.match(SPEC_TAG_RE);
  if (!m) return { body: dedent(raw.trim()), attrs: {} };
  const [, attrStr, inner] = m;
  const attrs: Record<string, string> = {};
  for (const a of attrStr.matchAll(ATTR_RE)) attrs[a[1]] = a[2];
  return { body: dedent(inner.replace(/^\n+|\n+$/g, '')), attrs };
}

function dedent(s: string): string {
  const lines = s.split('\n');
  let min = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0;
    if (indent < min) min = indent;
  }
  if (!Number.isFinite(min) || min === 0) return s;
  return lines.map((l) => l.slice(min)).join('\n');
}

function parseName(raw: string): { name: string; fork: string } {
  const idx = raw.indexOf('#');
  if (idx < 0) return { name: raw, fork: 'phase0' };
  return { name: raw.slice(0, idx), fork: raw.slice(idx + 1) };
}

async function fetchYaml(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'text/plain' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  const text = await res.text();
  // Use the dynamic import once — keeps yaml out of the eager bundle.
  const { parse } = await import('yaml');
  return parse(text);
}

export async function refreshFromGitHub(
  clients: Record<string, ClientConfig>,
): Promise<{ entities: SpecEntity[]; syncedAt: string }> {
  type Aggregate = Omit<SpecEntity, 'clients' | 'status'> & {
    clients: Record<string, ClientImpl>;
  };
  const byId = new Map<string, Aggregate>();

  for (const [clientId, c] of Object.entries(clients)) {
    for (const file of c.files) {
      const cat = TEKU_FILE_CATEGORY[file];
      if (!cat) continue;
      const url = `https://raw.githubusercontent.com/${c.repo}/${c.branch}/${c.specrefsPath}/${file}`;
      const parsed = await fetchYaml(url);
      const entries = TekuYamlSchema.parse(parsed);
      for (const entry of entries) {
        const { name, fork } = parseName(entry.name);
        const id = `${cat}/${fork}/${name}`;
        const { body, attrs } = parseSpecTag(entry.spec);
        const sources: SourceRef[] = entry.sources.map((s) => ({
          file: s.file,
          search: s.search,
          regex: s.regex,
        }));
        let agg = byId.get(id);
        if (!agg) {
          agg = {
            id,
            name,
            fork,
            category: cat,
            specText: body,
            specHash: attrs.hash,
            specStyle: attrs.style,
            clients: {},
          };
          byId.set(id, agg);
        } else if (!agg.specText && body) {
          agg.specText = body;
          agg.specHash = attrs.hash;
          agg.specStyle = attrs.style;
        }
        agg.clients[clientId] = { sources };
      }
    }
  }

  const entities: SpecEntity[] = [];
  for (const agg of byId.values()) {
    const status: SpecEntity['status'] = Object.values(agg.clients).some(
      (c) => c.sources.length > 0,
    )
      ? 'mapped'
      : 'unmapped';
    entities.push({ ...agg, status });
  }
  entities.sort((a, b) => {
    if (a.category !== b.category)
      return (CATEGORIES as readonly Category[]).indexOf(a.category) -
        (CATEGORIES as readonly Category[]).indexOf(b.category);
    if (a.fork !== b.fork) return a.fork.localeCompare(b.fork);
    return a.name.localeCompare(b.name);
  });

  return { entities, syncedAt: new Date().toISOString() };
}
