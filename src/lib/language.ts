// Light-touch language detection / labelling for the UI. We don't do real
// syntax highlighting (yet) — these helpers just power the colored language
// chips on each implementation pane and the optional <pre> class.

const EXT_TO_LANG: Record<string, string> = {
  java: 'Java',
  go: 'Go',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  rs: 'Rust',
  py: 'Python',
  nim: 'Nim',
  yml: 'YAML',
  yaml: 'YAML',
  json: 'JSON',
};

export function langForFile(file: string): string {
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? 'text';
}

// CSS class fragment used to colour language chips.
export function langClass(...candidates: string[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const slug = c.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (slug) return `lang-${slug}`;
  }
  return 'lang-text';
}
