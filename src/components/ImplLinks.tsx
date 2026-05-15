import type { ClientConfig, ClientImpl } from '../types/entity';
import { buildSourceUrl } from '../lib/githubUrl';

interface Props {
  client: ClientConfig;
  sha: string;
  impl: ClientImpl;
}

export function ImplLinks({ client, sha, impl }: Props) {
  if (impl.excluded) {
    return (
      <div className="excluded-reason" title="Listed in the client's .ethspecify.yml exceptions">
        {impl.excluded.reason}
      </div>
    );
  }
  if (impl.sources.length === 0) {
    return <p className="empty">No implementation registered.</p>;
  }
  return (
    <>
      {impl.sources.map((s, i) => {
        const url = buildSourceUrl(client, sha, s);
        const fileLabel = lastSeg(s.file);
        return (
          <div key={i} className="source-ref">
            <div className="top">
              <a href={url} target="_blank" rel="noreferrer noopener">
                {fileLabel}
              </a>
              {s.line && <span className="line">L{s.line}</span>}
              {s.lineMatches && s.lineMatches > 1 && (
                <span className="line" title="Multiple lines matched the search pattern">
                  ({s.lineMatches} matches)
                </span>
              )}
              {!s.line && s.search && (
                <button
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(s.search!)}
                  title="Copy search string"
                >
                  copy search
                </button>
              )}
            </div>
            <div className="path" title={s.file}>{s.file}</div>
            {s.search && (
              <div className="search-pattern">
                <code>{s.regex ? `/${s.search}/` : s.search}</code>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function lastSeg(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? path : path.slice(i + 1);
}
