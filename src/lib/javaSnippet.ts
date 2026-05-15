// Extract a meaningful snippet of Java source given an anchor line.
//
//   - If the search string contains `(` we treat it as a method: walk forward
//     from the first `{` after the anchor and brace-count to the matching `}`.
//   - If the search string contains `=` (assignment) we treat it as a field /
//     constant: walk forward until the next `;`.
//   - Otherwise we return the full file (containers, custom types).
//
// In all cases we also walk *backwards* a few lines to absorb any javadoc /
// annotations / single-line comments attached to the declaration.

export interface Snippet {
  code: string;
  startLine: number;
  endLine: number;
  truncated: boolean;
  totalLines: number;
}

export function extractSnippet(
  content: string,
  anchorLine: number | undefined,
  search: string | undefined,
): Snippet {
  const lines = content.split('\n');
  const totalLines = lines.length;

  if (!anchorLine) {
    const MAX = 200;
    return {
      code: lines.slice(0, MAX).join('\n'),
      startLine: 1,
      endLine: Math.min(MAX, totalLines),
      truncated: totalLines > MAX,
      totalLines,
    };
  }

  const anchorIdx = clamp(anchorLine - 1, 0, totalLines - 1);
  const startIdx = walkBackOverDocs(lines, anchorIdx);
  const kind = classify(search, lines[anchorIdx]);

  let endIdx: number;
  if (kind === 'method') {
    endIdx = walkForwardMethod(lines, anchorIdx);
  } else if (kind === 'field') {
    endIdx = walkForwardField(lines, anchorIdx);
  } else {
    // Unknown: cap at 60 lines past the anchor.
    endIdx = Math.min(anchorIdx + 60, totalLines - 1);
  }

  return {
    code: lines.slice(startIdx, endIdx + 1).join('\n'),
    startLine: startIdx + 1,
    endLine: endIdx + 1,
    truncated: false,
    totalLines,
  };
}

type Kind = 'method' | 'field' | 'unknown';

function classify(search: string | undefined, anchorText: string): Kind {
  if (search?.includes('(')) return 'method';
  if (search?.includes('=')) return 'field';
  if (/\b(public|private|protected|static)?\s*[\w<>?,\s\[\]]+\s+\w+\s*\(/.test(anchorText))
    return 'method';
  if (/=\s*[^=]/.test(anchorText)) return 'field';
  return 'unknown';
}

function walkBackOverDocs(lines: string[], anchorIdx: number): number {
  let i = anchorIdx - 1;
  const stop = Math.max(0, anchorIdx - 40);
  while (i >= stop) {
    const t = lines[i].trim();
    if (
      t === '' ||
      t.startsWith('//') ||
      t.startsWith('*') ||
      t.startsWith('/*') ||
      t.endsWith('*/') ||
      t.startsWith('@')
    ) {
      i--;
      continue;
    }
    break;
  }
  // Trim leading blank lines back to the first real content above the anchor.
  let start = i + 1;
  while (start < anchorIdx && lines[start].trim() === '') start++;
  return start;
}

function walkForwardMethod(lines: string[], anchorIdx: number): number {
  let depth = 0;
  let entered = false;
  const inString = { single: false, double: false, lineComment: false, block: false };

  for (let i = anchorIdx; i < lines.length; i++) {
    const line = lines[i];
    inString.lineComment = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      const next = line[j + 1];

      if (inString.lineComment) break;
      if (inString.block) {
        if (c === '*' && next === '/') { inString.block = false; j++; }
        continue;
      }
      if (inString.single) {
        if (c === '\\') { j++; continue; }
        if (c === "'") inString.single = false;
        continue;
      }
      if (inString.double) {
        if (c === '\\') { j++; continue; }
        if (c === '"') inString.double = false;
        continue;
      }

      if (c === '/' && next === '/') { inString.lineComment = true; break; }
      if (c === '/' && next === '*') { inString.block = true; j++; continue; }
      if (c === "'") { inString.single = true; continue; }
      if (c === '"') { inString.double = true; continue; }

      if (c === '{') { depth++; entered = true; }
      else if (c === '}') {
        depth--;
        if (entered && depth === 0) return i;
      }
    }
  }
  // Brace-balance never closed: fall back to a generous slice.
  return Math.min(anchorIdx + 80, lines.length - 1);
}

function walkForwardField(lines: string[], anchorIdx: number): number {
  for (let i = anchorIdx; i < Math.min(lines.length, anchorIdx + 20); i++) {
    // Strip trailing line-comment before checking for `;`.
    const stripped = lines[i].replace(/\/\/.*$/, '');
    if (stripped.includes(';')) return i;
  }
  return Math.min(anchorIdx + 5, lines.length - 1);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
