import type { Category, SpecEntity } from '../types/entity';

export type StatusFilter = 'mapped' | 'unmapped' | 'excluded';

export interface FilterState {
  forks: Set<string>;            // empty = all
  categories: Set<Category>;     // empty = all
  statuses: Set<StatusFilter>;   // empty = all
  clients: Set<string>;          // empty = all
  query: string;
}

export function defaultFilters(): FilterState {
  return {
    forks: new Set(),
    categories: new Set(),
    statuses: new Set(),
    clients: new Set(),
    query: '',
  };
}

export function applyFilters(
  entities: SpecEntity[],
  filters: FilterState,
): SpecEntity[] {
  const { forks, categories, statuses, clients, query } = filters;
  const q = query.trim().toLowerCase();
  return entities.filter((e) => {
    if (forks.size > 0 && !forks.has(e.fork)) return false;
    if (categories.size > 0 && !categories.has(e.category)) return false;
    if (statuses.size > 0 && !statuses.has(e.status)) return false;
    if (clients.size > 0) {
      const present = Object.keys(e.clients);
      if (!present.some((c) => clients.has(c))) return false;
    }
    if (q) {
      if (
        !e.name.toLowerCase().includes(q) &&
        !e.specText.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });
}

/* ----------------------------------------------------------------------------
 * URL <-> filter state serialization
 * -------------------------------------------------------------------------- */

export function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.query) p.set('q', f.query);
  if (f.forks.size) p.set('fork', [...f.forks].join(','));
  if (f.categories.size) p.set('cat', [...f.categories].join(','));
  if (f.statuses.size) p.set('status', [...f.statuses].join(','));
  if (f.clients.size) p.set('client', [...f.clients].join(','));
  return p;
}

export function filtersFromParams(p: URLSearchParams): FilterState {
  const f = defaultFilters();
  f.query = p.get('q') ?? '';
  for (const v of (p.get('fork') ?? '').split(',').filter(Boolean)) f.forks.add(v);
  for (const v of (p.get('cat') ?? '').split(',').filter(Boolean))
    f.categories.add(v as Category);
  for (const v of (p.get('status') ?? '').split(',').filter(Boolean))
    f.statuses.add(v as StatusFilter);
  for (const v of (p.get('client') ?? '').split(',').filter(Boolean)) f.clients.add(v);
  return f;
}
