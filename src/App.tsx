import { useEffect, useMemo, useState } from 'react';
import { loadBakedSnapshot, refreshFromGitHub } from './lib/loadSnapshot';
import {
  applyFilters,
  filtersFromParams,
  filtersToParams,
  type FilterState,
} from './lib/filters';
import type { SpecEntity, SnapshotMeta, ClientsConfig } from './types/entity';
import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { EntityList } from './components/EntityList';
import { RefreshButton } from './components/RefreshButton';
import { CoverageBar } from './components/CoverageBar';
import { EthspecifyBadge } from './components/EthspecifyBadge';

const baked = loadBakedSnapshot();

export function App() {
  const [entities, setEntities] = useState<SpecEntity[]>(baked.entities);
  const [meta, setMeta] = useState<SnapshotMeta>(baked.meta);
  const [clients] = useState<ClientsConfig>(baked.clients);
  const [filters, setFilters] = useState<FilterState>(() =>
    filtersFromParams(new URLSearchParams(window.location.search)),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL <-> filter sync
  useEffect(() => {
    const p = filtersToParams(filters);
    const newSearch = p.toString();
    const newUrl = newSearch
      ? `${window.location.pathname}?${newSearch}`
      : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [filters]);

  // Per-facet counts on the *unfiltered* dataset for the sidebar.
  const facetCounts = useMemo(() => computeFacetCounts(entities), [entities]);

  const filtered = useMemo(() => applyFilters(entities, filters), [entities, filters]);

  async function onRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const { entities: fresh, syncedAt } = await refreshFromGitHub(clients);
      setEntities(fresh);
      setMeta((m) => ({
        ...m,
        syncedAt,
        stats: recomputeStats(fresh),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Consensus-specs implementations</h1>
        <div className="meta">
          {Object.entries(clients).map(([id, c], i) => {
            const sha = meta.clientShas[id];
            const ver = meta.clientEthspecifyVersions?.[id];
            return (
              <span key={id}>
                {i > 0 && <span className="sep">·</span>}
                <a
                  className="client-pin"
                  href={`https://github.com/${c.repo}/tree/${sha ?? c.branch}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={`${c.name} @ ${sha ?? c.branch}${ver ? `\nethspecify ${ver}` : ''}`}
                >
                  {c.name} <code>{(sha ?? '').slice(0, 7)}</code>
                </a>
              </span>
            );
          })}
          <span className="sep">·</span>
          <EthspecifyBadge
            clients={clients}
            versions={meta.clientEthspecifyVersions ?? {}}
          />
          <span className="sep">·</span>
          <span title={new Date(meta.syncedAt).toLocaleString()}>
            Synced {formatAge(meta.syncedAt)}
          </span>
        </div>
        <div className="spacer" />
        <RefreshButton refreshing={refreshing} onClick={onRefresh} />
      </header>

      <Sidebar
        filters={filters}
        setFilters={setFilters}
        facetCounts={facetCounts}
        clients={clients}
      />

      <main className="main">
        {error && <div className="banner error">Refresh failed: {error}</div>}
        <div className="toolbar">
          <SearchBar
            value={filters.query}
            onChange={(query) => setFilters((f) => ({ ...f, query }))}
          />
          <div className="result-count">
            {filtered.length.toLocaleString()} / {entities.length.toLocaleString()}
          </div>
        </div>
        <CoverageBar entities={filtered} />
        <EntityList entities={filtered} clients={clients} meta={meta} />
      </main>
    </div>
  );
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function computeFacetCounts(entities: SpecEntity[]) {
  const forks: Record<string, number> = {};
  const categories: Record<string, number> = {};
  const statuses: Record<string, number> = { mapped: 0, unmapped: 0, excluded: 0 };
  const clients: Record<string, number> = {};
  for (const e of entities) {
    forks[e.fork] = (forks[e.fork] ?? 0) + 1;
    categories[e.category] = (categories[e.category] ?? 0) + 1;
    statuses[e.status] = (statuses[e.status] ?? 0) + 1;
    for (const c of Object.keys(e.clients)) clients[c] = (clients[c] ?? 0) + 1;
  }
  return { forks, categories, statuses, clients };
}

function recomputeStats(entities: SpecEntity[]): SnapshotMeta['stats'] {
  let mapped = 0,
    unmapped = 0,
    excluded = 0;
  const byFork: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const e of entities) {
    if (e.status === 'mapped') mapped++;
    else if (e.status === 'unmapped') unmapped++;
    else excluded++;
    byFork[e.fork] = (byFork[e.fork] ?? 0) + 1;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }
  return { total: entities.length, mapped, unmapped, excluded, byFork, byCategory };
}
