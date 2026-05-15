import type { SpecEntity } from '../types/entity';

interface Props {
  entities: SpecEntity[];
}

export function CoverageBar({ entities }: Props) {
  const total = entities.length;
  if (total === 0) return null;

  let mapped = 0,
    unmapped = 0,
    excluded = 0;
  for (const e of entities) {
    if (e.status === 'mapped') mapped++;
    else if (e.status === 'unmapped') unmapped++;
    else excluded++;
  }

  const pct = (n: number) => ((n / total) * 100).toFixed(1);

  return (
    <div className="coverage">
      <div className="bar" title={`${total} entities in current filter`}>
        <span className="mapped" style={{ width: `${(mapped / total) * 100}%` }} />
        <span className="excluded" style={{ width: `${(excluded / total) * 100}%` }} />
        <span className="unmapped" style={{ width: `${(unmapped / total) * 100}%` }} />
      </div>
      <div className="legend">
        <span><span className="dot" style={{ background: 'var(--mapped)' }} /> Mapped {mapped} ({pct(mapped)}%)</span>
        <span><span className="dot" style={{ background: 'var(--excluded)' }} /> Excluded {excluded} ({pct(excluded)}%)</span>
        <span><span className="dot" style={{ background: 'var(--unmapped)' }} /> Unmapped {unmapped} ({pct(unmapped)}%)</span>
      </div>
    </div>
  );
}
