# consensus-specs → client implementation browser

A static UI that maps every Ethereum [consensus-specs] entity (function,
constant, container, dataclass, config, preset, custom type) to where each
consensus client implements it. Mappings come from each client's ethspecify-
formatted `specrefs/` directory:

| Client | Language | Source |
|---|---|---|
| Teku | Java | [`Consensys/teku/specrefs`](https://github.com/Consensys/teku/tree/master/specrefs) |
| Prysm | Go | [`OffchainLabs/prysm/specrefs`](https://github.com/OffchainLabs/prysm/tree/develop/specrefs) |
| Lodestar | TypeScript | [`ChainSafe/lodestar/specrefs`](https://github.com/ChainSafe/lodestar/tree/unstable/specrefs) |

[consensus-specs]: https://github.com/ethereum/consensus-specs/tree/master/specs
[ethspecify]: https://github.com/ethereum/ethspecify

## What it shows

For each spec entity you get:

- The Python pseudocode from the spec, side-by-side with
- Each registered client source location, deep-linked to the exact line in
  GitHub at the pinned commit SHA, with an inline expander that fetches the
  raw file and slices out the relevant declaration (brace-counted for methods,
  one-line for fields / YAML keys),
- A status badge: `mapped`, `unmapped`, or `excluded` (with the reason from
  each client's `.ethspecify.yml`),
- Fork, category, and "library-provided" hints for KZG / light-client items.

Filters in the sidebar: fork (phase0 … gloas), category (functions, constants,
containers, dataclasses, configs, presets), status, and — once more clients
land — client. The filter state is serialised to the URL so views are
shareable.

## Layout

```
clients.json           # config-driven multi-client registry (Teku today)
scripts/sync-data.ts   # build-time fetch + line resolver
src/
  data/snapshot.json   # baked snapshot consumed by the UI
  types/entity.ts      # Zod schemas + types
  lib/                 # pure helpers
  components/          # React UI
.github/workflows/
  sync.yml             # daily cron → PR refreshing the snapshot
  deploy.yml           # GH Pages deploy
```

## Develop

```sh
npm install
npm run sync     # pulls the latest Teku specrefs and consensus-specs SHA into src/data/snapshot.json
npm run dev      # http://localhost:5173/consensus-specs-browser/
npm run build    # production build into dist/
```

`npm run sync` resolves the current `master` SHA for each repo in
`clients.json` (plus `ethereum/consensus-specs`), fetches every specrefs YAML
file at that SHA, and for each `{ file, search }` source ref opens the
referenced Java file and resolves the line number. Results are cached under
`.cache/` keyed by SHA, so re-running at the same SHA is fast.

To raise GitHub's API rate limit during local syncs, set `GITHUB_TOKEN`:

```sh
export GITHUB_TOKEN=ghp_…
```

## Refresh button

The in-app **Refresh** button re-fetches the same YAML files live from
`raw.githubusercontent.com` (CORS is `*` so no proxy is needed) and rebuilds
the dataset in memory. It does **not** resolve line numbers (too many requests
for a browser), so live-refreshed entries fall back to a "copy search"
affordance and a plain file link. To restore line-anchored links, run
`npm run sync` and rebuild.

## Adding another client

1. Add a new entry to `clients.json` with the same shape as `teku`:

   ```json
   {
     "lighthouse": {
       "name": "Lighthouse",
       "language": "Rust",
       "repo": "sigp/lighthouse",
       "branch": "stable",
       "specrefsPath": "specrefs",
       "files": ["functions.yml", "constants.yml", "containers.yml", "dataclasses.yml", "configs.yml", "presets.yml"],
       "exceptionsFile": ".ethspecify.yml",
       "sourceUrlTemplate": "https://github.com/sigp/lighthouse/blob/{sha}/{file}",
       "sourceUrlLineTemplate": "https://github.com/sigp/lighthouse/blob/{sha}/{file}#L{line}",
       "rawUrlTemplate": "https://raw.githubusercontent.com/sigp/lighthouse/{sha}/{file}"
     }
   }
   ```

2. `npm run sync` — entities pick up a per-client implementation entry; the UI
   exposes a client filter automatically when more than one is configured.

## Deployment

The `deploy.yml` workflow builds and publishes to GitHub Pages on every push
to `main`. Enable Pages with **Source: GitHub Actions** in repo settings. The
`base` path is `/consensus-specs-browser/` — override with `VITE_BASE` if you
host under a different path.

The `sync.yml` workflow runs daily and opens a PR if the snapshot has changed.
