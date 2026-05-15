import type { ClientConfig, SourceRef } from '../types/entity';

export function buildSourceUrl(
  client: ClientConfig,
  sha: string,
  source: SourceRef,
): string {
  if (source.line && source.line > 0) {
    return client.sourceUrlLineTemplate
      .replace('{sha}', sha)
      .replace('{file}', source.file)
      .replace('{line}', String(source.line));
  }
  return client.sourceUrlTemplate.replace('{sha}', sha).replace('{file}', source.file);
}

export function buildSpecMarkdownUrl(
  fork: string,
  specSourceFile: string | undefined,
  sha: string | undefined,
): string {
  const ref = sha ?? 'master';
  if (specSourceFile) {
    return `https://github.com/ethereum/consensus-specs/blob/${ref}/specs/${specSourceFile}`;
  }
  return `https://github.com/ethereum/consensus-specs/tree/${ref}/specs/${fork}`;
}
