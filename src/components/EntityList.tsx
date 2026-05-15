import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { ClientsConfig, SnapshotMeta, SpecEntity } from '../types/entity';
import { EntityCard } from './EntityCard';

interface Props {
  entities: SpecEntity[];
  clients: ClientsConfig;
  meta: SnapshotMeta;
}

export function EntityList({ entities, clients, meta }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 360, // initial estimate; measured exactly via ResizeObserver
    overscan: 4,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  if (entities.length === 0) {
    return (
      <div ref={parentRef} className="entity-list">
        <div className="empty-state">
          <p>No entities match the current filters.</p>
          <p style={{ fontSize: 12 }}>Clear filters or broaden your search.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="entity-list">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const e = entities[vi.index];
          return (
            <div
              key={e.id}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <EntityCard entity={e} clients={clients} meta={meta} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
