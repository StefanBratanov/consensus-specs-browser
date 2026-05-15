import { z } from 'zod';

/* ----------------------------------------------------------------------------
 * Category and fork enumerations
 * -------------------------------------------------------------------------- */

export const CATEGORIES = [
  'function',
  'constant_var',
  'config_var',
  'preset_var',
  'ssz_object',
  'dataclass',
  'custom_type',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  function: 'Functions',
  constant_var: 'Constants',
  config_var: 'Configs',
  preset_var: 'Presets',
  ssz_object: 'Containers',
  dataclass: 'Dataclasses',
  custom_type: 'Custom Types',
};

// Maps a specrefs filename to the canonical category used in the UI. Same
// across clients — Teku/Prysm publish six files, Lodestar adds `types.yml`
// for custom types.
export const FILE_CATEGORY: Record<string, Category> = {
  'functions.yml': 'function',
  'constants.yml': 'constant_var',
  'configs.yml': 'config_var',
  'presets.yml': 'preset_var',
  'containers.yml': 'ssz_object',
  'dataclasses.yml': 'dataclass',
  'types.yml': 'custom_type',
};

// Backwards-compatible alias.
export const TEKU_FILE_CATEGORY = FILE_CATEGORY;

// Inside a `<spec>` tag, the attribute keyed by category.
export const SPEC_TAG_ATTR_BY_CATEGORY: Record<Category, string> = {
  function: 'fn',
  constant_var: 'constant_var',
  config_var: 'config_var',
  preset_var: 'preset_var',
  ssz_object: 'container',
  dataclass: 'dataclass',
  custom_type: 'custom_type',
};

/* ----------------------------------------------------------------------------
 * Zod schemas — Teku YAML inputs
 * -------------------------------------------------------------------------- */

export const TekuSourceRefSchema = z.object({
  file: z.string(),
  search: z.string().optional(),
  regex: z.boolean().optional(),
});

export const TekuEntrySchema = z.object({
  name: z.string(), // "<entity>#<fork>"
  sources: z.array(TekuSourceRefSchema).default([]),
  spec: z.string().default(''),
});

export const TekuYamlSchema = z.array(TekuEntrySchema);

/* ----------------------------------------------------------------------------
 * Snapshot data model — what the UI consumes
 * -------------------------------------------------------------------------- */

export const SourceRefSchema = z.object({
  file: z.string(),
  search: z.string().optional(),
  regex: z.boolean().optional(),
  line: z.number().int().positive().optional(),
  lineMatches: z.number().int().nonnegative().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ClientImplSchema = z.object({
  sources: z.array(SourceRefSchema),
  excluded: z
    .object({
      reason: z.string(),
    })
    .optional(),
});
export type ClientImpl = z.infer<typeof ClientImplSchema>;

export const SpecEntitySchema = z.object({
  id: z.string(), // `${category}/${fork}/${name}`
  name: z.string(),
  fork: z.string(),
  category: z.enum(CATEGORIES),
  specText: z.string(),
  specHash: z.string().optional(),
  specStyle: z.string().optional(),
  specSourceFile: z.string().optional(),
  clients: z.record(z.string(), ClientImplSchema),
  status: z.enum(['mapped', 'unmapped', 'excluded']),
  libraryProvided: z.boolean().optional(),
});
export type SpecEntity = z.infer<typeof SpecEntitySchema>;

export const ClientConfigSchema = z.object({
  name: z.string(),
  language: z.string(),
  repo: z.string(),
  branch: z.string(),
  specrefsPath: z.string(),
  files: z.array(z.string()),
  exceptionsFile: z.string().optional(),
  sourceUrlTemplate: z.string(),
  sourceUrlLineTemplate: z.string(),
  rawUrlTemplate: z.string(),
});
export type ClientConfig = z.infer<typeof ClientConfigSchema>;

export const ClientsConfigSchema = z.record(z.string(), ClientConfigSchema);
export type ClientsConfig = z.infer<typeof ClientsConfigSchema>;

export const SnapshotMetaSchema = z.object({
  syncedAt: z.string(),
  pyspecVersion: z.string(),
  specsSha: z.string().optional(),
  clientShas: z.record(z.string(), z.string()),
  // Per-client ethspecify schema version (from `.ethspecify.yml`). Absent for
  // clients that don't ship one (e.g. Prysm).
  clientEthspecifyVersions: z.record(z.string(), z.string()).default({}),
  stats: z.object({
    total: z.number(),
    mapped: z.number(),
    unmapped: z.number(),
    excluded: z.number(),
    byFork: z.record(z.string(), z.number()),
    byCategory: z.record(z.string(), z.number()),
  }),
});
export type SnapshotMeta = z.infer<typeof SnapshotMetaSchema>;

export const SnapshotSchema = z.object({
  meta: SnapshotMetaSchema,
  clients: ClientsConfigSchema,
  entities: z.array(SpecEntitySchema),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
