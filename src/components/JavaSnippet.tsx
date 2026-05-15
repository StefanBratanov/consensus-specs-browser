import { useEffect, useState } from 'react';
import { fetchSource, buildRawUrl } from '../lib/fetchSource';
import { extractSnippet } from '../lib/javaSnippet';
import type { ClientConfig, SourceRef } from '../types/entity';

interface Props {
  client: ClientConfig;
  sha: string;
  source: SourceRef;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; code: string; startLine: number; endLine: number; totalLines: number; truncated: boolean; showFull: boolean; fullCode: string }
  | { kind: 'error'; message: string };

export function JavaSnippet({ client, sha, source }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    if (!open || state.kind !== 'idle') return;
    setState({ kind: 'loading' });
    const url = buildRawUrl(client.rawUrlTemplate, sha, source.file);
    fetchSource(url).then(
      (content) => {
        const snip = extractSnippet(content, source.line, source.search);
        setState({
          kind: 'ready',
          code: snip.code,
          startLine: snip.startLine,
          endLine: snip.endLine,
          totalLines: snip.totalLines,
          truncated: snip.truncated,
          showFull: false,
          fullCode: content,
        });
      },
      (err: Error) => setState({ kind: 'error', message: err.message }),
    );
  }, [open, state.kind, client.rawUrlTemplate, sha, source.file, source.line, source.search]);

  return (
    <div className="snippet">
      <button
        className="snippet-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="caret">{open ? '▾' : '▸'}</span>
        <span>{open ? 'Hide source' : 'Show source'}</span>
      </button>
      {open && (
        <div className="snippet-body">
          {state.kind === 'loading' && <p className="snippet-status">Loading…</p>}
          {state.kind === 'error' && (
            <p className="snippet-status error">Failed to load: {state.message}</p>
          )}
          {state.kind === 'ready' && (
            <>
              <div className="snippet-meta">
                <span>
                  Lines {state.startLine}–{state.endLine} of {state.totalLines}
                </span>
                <button
                  className="copy-btn"
                  onClick={() =>
                    setState((s) =>
                      s.kind === 'ready' ? { ...s, showFull: !s.showFull } : s,
                    )
                  }
                >
                  {state.showFull ? 'Snippet only' : 'Show full file'}
                </button>
              </div>
              <pre className="code java">
                <code>{state.showFull ? state.fullCode : state.code}</code>
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
