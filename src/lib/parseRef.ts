// Parse the `name` field from Teku specrefs YAML: "<entity>#<fork>".
//
// Examples:
//   "add_flag#altair"          -> { name: "add_flag", fork: "altair" }
//   "BLS_MODULUS#deneb"        -> { name: "BLS_MODULUS", fork: "deneb" }
//   "Bytes32"                  -> { name: "Bytes32", fork: null }
export function parseEntityRef(raw: string): { name: string; fork: string | null } {
  const idx = raw.indexOf('#');
  if (idx < 0) return { name: raw, fork: null };
  return { name: raw.slice(0, idx), fork: raw.slice(idx + 1) };
}

// Stable join key.
export function entityId(category: string, fork: string, name: string): string {
  return `${category}/${fork}/${name}`;
}

// Strip the surrounding <spec ...>...</spec> wrapper from a Teku YAML spec block
// and dedent the body. Returns { body, attrs }.
const SPEC_TAG_RE = /^\s*<spec\b([^>]*)>([\s\S]*?)<\/spec>\s*$/;
const ATTR_RE = /(\w+)\s*=\s*"([^"]*)"/g;

export function parseSpecTag(raw: string): {
  body: string;
  attrs: Record<string, string>;
} {
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
