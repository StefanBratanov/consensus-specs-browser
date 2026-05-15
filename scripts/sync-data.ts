/**
 * Build-time data sync.
 *
 *   1. Resolves master SHA for each configured client repo and for ethereum/consensus-specs.
 *   2. Fetches each client's specrefs YAMLs + .ethspecify.yml (exceptions) at the pinned SHA.
 *   3. For every source ref with a `search` string, fetches the target file (cached by SHA)
 *      and resolves the line number.
 *   4. Emits src/data/snapshot.json (a single normalized array of SpecEntity).
 *
 * Run with:  npm run sync
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import {
  CATEGORIES,
  type Category,
  type ClientImpl,
  type ClientConfig,
  ClientsConfigSchema,
  type SourceRef,
  type SpecEntity,
  type Snapshot,
  SnapshotSchema,
  TEKU_FILE_CATEGORY,
  TekuYamlSchema,
} from '../src/types/entity';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const CACHE_DIR = join(ROOT, '.cache');
const OUT_PATH = join(ROOT, 'src/data/snapshot.json');

const USER_AGENT = 'consensus-specs-browser-sync/0.1';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

/* ----------------------------------------------------------------------------
 * Small HTTP helpers
 * -------------------------------------------------------------------------- */

async function ghJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
      ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub ${url} -> ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function rawText(repo: string, sha: string, path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo}/${sha}/${path}`;
  const cacheKey = join(CACHE_DIR, repo.replace('/', '__'), sha, path);
  if (existsSync(cacheKey)) {
    return await readFile(cacheKey, 'utf8');
  }
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`raw ${url} -> ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  await mkdir(dirname(cacheKey), { recursive: true });
  await writeFile(cacheKey, text, 'utf8');
  return text;
}

/* ----------------------------------------------------------------------------
 * Spec tag and source parsing
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

/* ----------------------------------------------------------------------------
 * Exceptions (.ethspecify.yml)
 * -------------------------------------------------------------------------- */

type ExceptionMap = Map<string, string>; // key: `${category}/${fork|*}/${name}` -> reason comment

// Plural -> internal category. .ethspecify.yml uses plural directory-like keys.
const PLURAL_TO_CATEGORY: Record<string, Category> = {
  configs: 'config_var',
  constants: 'constant_var',
  containers: 'ssz_object',
  dataclasses: 'dataclass',
  functions: 'function',
  presets: 'preset_var',
  custom_types: 'custom_type',
};

interface EthspecifyExceptions {
  version?: string;
  specrefs?: { exceptions?: Record<string, string[]> };
}

function buildExceptionMap(parsed: EthspecifyExceptions, rawText: string): ExceptionMap {
  const exMap: ExceptionMap = new Map();
  const exceptions = parsed.specrefs?.exceptions ?? {};

  // Pre-build a name -> trailing-comment lookup from the raw YAML so we can attach
  // a human-readable reason. The conventional pattern is a `# Reason` comment line
  // above a block of `- ITEM#fork` entries.
  const reasonByName = buildCommentLookup(rawText);

  for (const [plural, items] of Object.entries(exceptions)) {
    const cat = PLURAL_TO_CATEGORY[plural];
    if (!cat) continue;
    for (const item of items) {
      const { name, fork } = parseName(item);
      const forkKey = item.includes('#') ? fork : '*';
      const key = `${cat}/${forkKey}/${name}`;
      const reason = reasonByName.get(item) ?? 'Excluded from coverage.';
      exMap.set(key, reason);
    }
  }
  return exMap;
}

function buildCommentLookup(rawText: string): Map<string, string> {
  // Convention in .ethspecify.yml: each excluded item is preceded by a
  // `# reason` comment line (possibly multi-line) and items are grouped in
  // blocks separated by blank lines. The current comment resets on any line
  // that is neither a comment nor an item — including blanks — so reasons do
  // not bleed across sections.
  const out = new Map<string, string>();
  const lines = rawText.split('\n');
  let currentComment = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      const comment = trimmed.replace(/^#+\s?/, '');
      currentComment = currentComment ? `${currentComment} ${comment}` : comment;
      continue;
    }
    const itemMatch = trimmed.match(/^-\s+(.+?)\s*$/);
    if (itemMatch) {
      out.set(itemMatch[1], currentComment || 'Excluded from coverage.');
      continue;
    }
    currentComment = '';
  }
  return out;
}

function lookupException(
  exMap: ExceptionMap,
  category: Category,
  fork: string,
  name: string,
): string | undefined {
  return exMap.get(`${category}/${fork}/${name}`) ?? exMap.get(`${category}/*/${name}`);
}

/* ----------------------------------------------------------------------------
 * Line number resolution
 * -------------------------------------------------------------------------- */

async function resolveLine(
  repo: string,
  sha: string,
  source: SourceRef,
): Promise<{ line?: number; matches: number }> {
  if (!source.search) return { matches: 0 };
  let content: string;
  try {
    content = await rawText(repo, sha, source.file);
  } catch (err) {
    process.stderr.write(`  [warn] cannot fetch ${source.file}: ${(err as Error).message}\n`);
    return { matches: 0 };
  }
  const lines = content.split('\n');
  const matcher = source.regex
    ? safeRegex(source.search)
    : (line: string) => line.includes(source.search!);
  if (!matcher) return { matches: 0 };

  let firstHit: number | undefined;
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (matcher(lines[i])) {
      count++;
      if (firstHit === undefined) firstHit = i + 1;
    }
  }
  return { line: firstHit, matches: count };
}

function safeRegex(pattern: string): ((line: string) => boolean) | null {
  try {
    const re = new RegExp(pattern);
    return (line: string) => re.test(line);
  } catch (err) {
    process.stderr.write(`  [warn] bad regex /${pattern}/: ${(err as Error).message}\n`);
    return null;
  }
}

/* ----------------------------------------------------------------------------
 * Library-provided detection
 * -------------------------------------------------------------------------- */

const LIBRARY_PROVIDED_HINTS = [
  /^MAX_REQUEST_LIGHT_CLIENT/,
  /^LIGHT_CLIENT_/,
  /^LightClient/,
  /^BYTES_PER_COMMITMENT$/,
  /^BYTES_PER_PROOF$/,
  /^FIAT_SHAMIR_/,
  /^G1_POINT_AT_INFINITY$/,
  /^G2_POINT_AT_INFINITY$/,
  /^KZG_/,
  /^PRIMITIVE_ROOT_OF_UNITY$/,
  /^RANDOM_CHALLENGE_KZG_/,
];

function isLibraryProvided(name: string): boolean {
  return LIBRARY_PROVIDED_HINTS.some((re) => re.test(name));
}

/* ----------------------------------------------------------------------------
 * Main
 * -------------------------------------------------------------------------- */

async function main() {
  console.log(`[sync] ROOT=${ROOT}`);
  await mkdir(CACHE_DIR, { recursive: true });

  const clientsRaw = JSON.parse(await readFile(join(ROOT, 'clients.json'), 'utf8'));
  const clients = ClientsConfigSchema.parse(clientsRaw);

  // ------------- Resolve SHAs -------------
  const clientShas: Record<string, string> = {};
  for (const [id, c] of Object.entries(clients)) {
    const branch = await ghJson<{ commit: { sha: string } }>(
      `https://api.github.com/repos/${c.repo}/branches/${c.branch}`,
    );
    clientShas[id] = branch.commit.sha;
    console.log(`[sync] ${id} @ ${c.repo}#${c.branch} = ${clientShas[id]}`);
  }
  const specsBranch = await ghJson<{ commit: { sha: string } }>(
    'https://api.github.com/repos/ethereum/consensus-specs/branches/master',
  );
  const specsSha = specsBranch.commit.sha;
  console.log(`[sync] consensus-specs master = ${specsSha}`);

  // ------------- Aggregate entities across clients -------------
  type Aggregate = Omit<SpecEntity, 'clients' | 'status'> & {
    clients: Record<string, ClientImpl>;
  };
  const byId = new Map<string, Aggregate>();
  const clientEthspecifyVersions: Record<string, string> = {};

  for (const [clientId, c] of Object.entries(clients)) {
    const sha = clientShas[clientId];
    console.log(`[sync] processing ${clientId} files...`);

    // exceptions (optional — Prysm currently ships no .ethspecify.yml)
    let exMap: ExceptionMap = new Map();
    if (c.exceptionsFile) {
      try {
        const raw = await rawText(c.repo, sha, `${c.specrefsPath}/${c.exceptionsFile}`);
        const parsed = parseYaml(raw) as EthspecifyExceptions;
        if (parsed.version) {
          clientEthspecifyVersions[clientId] = parsed.version;
          console.log(`[sync]   ethspecify version: ${parsed.version}`);
        }
        exMap = buildExceptionMap(parsed, raw);
        console.log(`[sync]   ${exMap.size} exception entries`);
      } catch (err) {
        console.warn(
          `[sync]   no exceptions file (${c.exceptionsFile}): ${(err as Error).message}`,
        );
      }
    }

    for (const file of c.files) {
      const cat = TEKU_FILE_CATEGORY[file];
      if (!cat) {
        console.warn(`[sync]   skipping unknown file ${file}`);
        continue;
      }
      const raw = await rawText(c.repo, sha, `${c.specrefsPath}/${file}`);
      const parsed = parseYaml(raw);
      const entries = TekuYamlSchema.parse(parsed);
      console.log(`[sync]   ${file}: ${entries.length} entries`);

      let unmatched = 0;
      for (const entry of entries) {
        const { name, fork } = parseName(entry.name);
        const id = `${cat}/${fork}/${name}`;
        const { body, attrs } = parseSpecTag(entry.spec);

        const resolved: SourceRef[] = [];
        for (const s of entry.sources) {
          const { line, matches } = await resolveLine(c.repo, sha, s);
          if (s.search && line === undefined) unmatched++;
          resolved.push({
            file: s.file,
            search: s.search,
            regex: s.regex,
            line,
            lineMatches: matches,
          });
        }
        const exReason = lookupException(exMap, cat, fork, name);
        const clientImpl: ClientImpl = {
          sources: resolved,
          ...(exReason && resolved.length === 0 ? { excluded: { reason: exReason } } : {}),
        };

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
            libraryProvided: isLibraryProvided(name) || undefined,
          };
          byId.set(id, agg);
        } else if (!agg.specText && body) {
          agg.specText = body;
          agg.specHash = attrs.hash;
          agg.specStyle = attrs.style;
        }
        agg.clients[clientId] = clientImpl;
      }
      if (unmatched > 0) {
        console.warn(`[sync]   ${file}: ${unmatched} search strings did not match`);
      }
    }
  }

  // ------------- Aggregate -> SpecEntity (with status) -------------
  const entities: SpecEntity[] = [];
  let mapped = 0;
  let unmappedCount = 0;
  let excludedCount = 0;
  const byFork: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const agg of byId.values()) {
    const status = computeStatus(agg.clients);
    const e: SpecEntity = {
      ...agg,
      status,
    };
    entities.push(e);
    if (status === 'mapped') mapped++;
    else if (status === 'unmapped') unmappedCount++;
    else excludedCount++;
    byFork[e.fork] = (byFork[e.fork] ?? 0) + 1;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }

  entities.sort((a, b) => {
    if (a.category !== b.category)
      return CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
    if (a.fork !== b.fork) return a.fork.localeCompare(b.fork);
    return a.name.localeCompare(b.name);
  });

  // ------------- Emit -------------
  const snapshot: Snapshot = {
    meta: {
      syncedAt: new Date().toISOString(),
      pyspecVersion: 'teku-specrefs',
      specsSha,
      clientShas,
      clientEthspecifyVersions,
      stats: {
        total: entities.length,
        mapped,
        unmapped: unmappedCount,
        excluded: excludedCount,
        byFork,
        byCategory,
      },
    },
    clients,
    entities,
  };
  SnapshotSchema.parse(snapshot);

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(snapshot), 'utf8');

  const sizeBytes = (await stat(OUT_PATH)).size;
  console.log(
    `[sync] wrote ${OUT_PATH} (${(sizeBytes / 1024).toFixed(1)} KB, ${entities.length} entities: ${mapped} mapped, ${unmappedCount} unmapped, ${excludedCount} excluded)`,
  );
}

function computeStatus(clients: Record<string, ClientImpl>): SpecEntity['status'] {
  const impls = Object.values(clients);
  if (impls.some((c) => c.sources.length > 0)) return 'mapped';
  if (impls.some((c) => c.excluded)) return 'excluded';
  return 'unmapped';
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
