import type { ClientsConfig } from '../types/entity';

interface Props {
  clients: ClientsConfig;
  versions: Record<string, string>;
}

// Renders a compact ethspecify-schema-version chip in the header.
//
//   - All clients with a recorded version agree → single chip "ethspecify vX".
//   - Versions diverge → chip says "ethspecify ⚠ mixed" and tooltip lists each
//     client's version (clients without a `.ethspecify.yml` like Prysm are
//     called out explicitly).
export function EthspecifyBadge({ clients, versions }: Props) {
  const ids = Object.keys(clients);
  const distinct = new Set<string>();
  for (const v of Object.values(versions)) if (v) distinct.add(v);

  if (distinct.size === 0) return null;

  const tooltipLines = ids.map(
    (id) => `${clients[id].name}: ${versions[id] ?? 'no .ethspecify.yml'}`,
  );

  if (distinct.size === 1) {
    const [only] = distinct;
    return (
      <span
        className="ethspecify-chip"
        title={tooltipLines.join('\n')}
      >
        ethspecify <code>{only}</code>
      </span>
    );
  }

  return (
    <span
      className="ethspecify-chip mixed"
      title={tooltipLines.join('\n')}
    >
      ethspecify ⚠ mixed
    </span>
  );
}
