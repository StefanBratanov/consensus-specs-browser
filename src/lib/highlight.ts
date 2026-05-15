// Syntax highlighting wrapper around Prism.
//
// We import only the language definitions we actually use so the bundle
// stays small. Languages: python (spec pseudocode), java/go/typescript
// (client implementations), javascript (Lodestar tests etc.), yaml
// (preset / config files).

import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-yaml';

const LANG_ID: Record<string, string> = {
  python: 'python',
  java: 'java',
  go: 'go',
  typescript: 'typescript',
  javascript: 'javascript',
  yaml: 'yaml',
  text: 'none',
};

export function highlight(code: string, lang: string): string {
  const id = LANG_ID[lang.toLowerCase()] ?? 'none';
  if (id === 'none' || !Prism.languages[id]) {
    return escapeHtml(code);
  }
  try {
    return Prism.highlight(code, Prism.languages[id], id);
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
