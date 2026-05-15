import type { ClientsConfig, SnapshotMeta, SpecEntity } from '../types/entity';
import { CATEGORY_LABELS } from '../types/entity';
import { ImplLinks } from './ImplLinks';
import { buildSpecMarkdownUrl } from '../lib/githubUrl';
import { langClass } from '../lib/language';

interface Props {
  entity: SpecEntity;
  clients: ClientsConfig;
  meta: SnapshotMeta;
}

export function EntityCard({ entity, clients, meta }: Props) {
  return (
    <article className="entity-card" id={`entity-${entity.id}`}>
      <header className="entity-head">
        <span className="name">{entity.name}</span>
        <span className="badge fork">{entity.fork}</span>
        <span className="badge cat">{CATEGORY_LABELS[entity.category]}</span>
        <span className={`badge status-${entity.status}`}>{entity.status}</span>
        {entity.libraryProvided && (
          <span
            className="badge library"
            title="Provided by an external library (KZG, light client SSE, etc.)"
          >
            library
          </span>
        )}
        <a
          className="spec-link"
          href={buildSpecMarkdownUrl(entity.fork, entity.specSourceFile, meta.specsSha)}
          target="_blank"
          rel="noreferrer noopener"
        >
          consensus-specs ↗
        </a>
      </header>

      <div className="entity-body">
        <section className="spec-pane">
          <div className="pane-label">
            <span className={`lang-chip ${langClass('Python')}`}>Python</span>
            <span>Spec pseudocode</span>
            {entity.specHash && (
              <span style={{ marginLeft: 'auto', color: 'var(--text-mute)', fontSize: 11 }}>
                hash {entity.specHash}
              </span>
            )}
          </div>
          {entity.specText.trim() ? (
            <pre className="code">
              <code>{entity.specText}</code>
            </pre>
          ) : (
            <p className="empty">
              {entity.specStyle === 'diff'
                ? 'Spec is defined as a diff against an earlier fork. See the prior fork’s entry.'
                : 'No spec body recorded.'}
            </p>
          )}
        </section>

        <section className="impl-pane">
          {Object.entries(entity.clients).map(([clientId, impl]) => {
            const client = clients[clientId];
            if (!client) return null;
            const sha = meta.clientShas[clientId] ?? client.branch;
            return (
              <div key={clientId}>
                <div className="pane-label">
                  <span className={`lang-chip ${langClass(client.language)}`}>
                    {client.language}
                  </span>
                  <span>{client.name}</span>
                  {impl.excluded && (
                    <span
                      className="badge status-excluded"
                      style={{ marginLeft: 'auto' }}
                    >
                      excluded
                    </span>
                  )}
                </div>
                <ImplLinks client={client} sha={sha} impl={impl} />
              </div>
            );
          })}
        </section>
      </div>
    </article>
  );
}
