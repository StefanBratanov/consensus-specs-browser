import { CATEGORIES, type Category, type ClientsConfig } from '../types/entity';
import type { FilterState, StatusFilter } from '../lib/filters';

const FORK_ORDER = [
  'phase0',
  'altair',
  'bellatrix',
  'capella',
  'deneb',
  'electra',
  'fulu',
  'gloas',
  'heze',
];

const CATEGORY_LABELS: Record<Category, string> = {
  function: 'Functions',
  constant_var: 'Constants',
  config_var: 'Configs',
  preset_var: 'Presets',
  ssz_object: 'Containers',
  dataclass: 'Dataclasses',
  custom_type: 'Custom Types',
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  mapped: 'Mapped',
  unmapped: 'Unmapped',
  excluded: 'Excluded',
};

interface Props {
  filters: FilterState;
  setFilters: (next: FilterState | ((prev: FilterState) => FilterState)) => void;
  facetCounts: {
    forks: Record<string, number>;
    categories: Record<string, number>;
    statuses: Record<string, number>;
    clients: Record<string, number>;
  };
  clients: ClientsConfig;
}

export function Sidebar({ filters, setFilters, facetCounts, clients }: Props) {
  function toggle<T extends string>(set: Set<T>, value: T) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  const knownForks = new Set(Object.keys(facetCounts.forks));
  const orderedForks = [
    ...FORK_ORDER.filter((f) => knownForks.has(f)),
    ...[...knownForks].filter((f) => !FORK_ORDER.includes(f)).sort(),
  ];

  const anyActive =
    filters.forks.size +
    filters.categories.size +
    filters.statuses.size +
    filters.clients.size +
    (filters.query ? 1 : 0) >
    0;

  return (
    <aside className="sidebar">
      <h3>Fork</h3>
      {orderedForks.map((fork) => (
        <label key={fork}>
          <input
            type="checkbox"
            checked={filters.forks.has(fork)}
            onChange={() =>
              setFilters((f) => ({ ...f, forks: toggle(f.forks, fork) }))
            }
          />
          <span>{fork}</span>
          <span className="count">{facetCounts.forks[fork] ?? 0}</span>
        </label>
      ))}

      <h3>Category</h3>
      {CATEGORIES.map((cat) => (
        <label key={cat}>
          <input
            type="checkbox"
            checked={filters.categories.has(cat)}
            onChange={() =>
              setFilters((f) => ({ ...f, categories: toggle(f.categories, cat) }))
            }
          />
          <span>{CATEGORY_LABELS[cat]}</span>
          <span className="count">{facetCounts.categories[cat] ?? 0}</span>
        </label>
      ))}

      <h3>Status</h3>
      {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
        <label key={s}>
          <input
            type="checkbox"
            checked={filters.statuses.has(s)}
            onChange={() =>
              setFilters((f) => ({ ...f, statuses: toggle(f.statuses, s) }))
            }
          />
          <span>{STATUS_LABELS[s]}</span>
          <span className="count">{facetCounts.statuses[s] ?? 0}</span>
        </label>
      ))}

      {Object.keys(clients).length > 1 && (
        <>
          <h3>Client</h3>
          {Object.entries(clients).map(([id, c]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={filters.clients.has(id)}
                onChange={() =>
                  setFilters((f) => ({ ...f, clients: toggle(f.clients, id) }))
                }
              />
              <span>{c.name}</span>
              <span className="count">{facetCounts.clients[id] ?? 0}</span>
            </label>
          ))}
        </>
      )}

      {anyActive && (
        <button
          className="clear-btn"
          onClick={() =>
            setFilters({
              forks: new Set(),
              categories: new Set(),
              statuses: new Set(),
              clients: new Set(),
              query: '',
            })
          }
        >
          Clear filters
        </button>
      )}
    </aside>
  );
}
