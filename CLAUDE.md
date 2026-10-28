# CLAUDE.md — toolbox_sdk (@thaiwater/toolbox-sdk)

Reusable Photo / Draw / Data Files / Navigation tools for React web maps laid out as three panels (Map, Layer, Toolbox). Read `README.md` (API) and `CHANGELOG.md` (contract history) before changing contracts. GitHub: bird50/webmap_toolbox_sdk, branch `main`.

## Consumers — check them when you change anything

- `../simple_gis_webapp` (ThaiWater GIS, Next.js 16, MapLibre 5) — the production host. Installs this package as a copied `file:` dependency.
- `examples/react-maplibre` (port 4174) and `examples/leaflet` (port 4175) — prove the API works on two engines.
- The service HTTP contract belongs to `../toolbox_service`; the SDK only talks to a host gateway (`PublicClient`), never to the service or its key.

## Layout

| Path | Contents |
| --- | --- |
| `src/tools/<tool>/` | Everything one tool owns: `index.ts` (its public entry), `plugin.tsx` (factory), components, store, parsers, `messages/` |
| `src/contracts` | Zod contracts shared with `../toolbox_service` (copied there by its `npm run contracts:sync`); import only `zod` and each other |
| `src/core` | No React/engine: layers, `LayerRegistry`, `MapAdapter` + GeoJSON surface types, workspace store, `PublicClient`, data table helpers; `index.ts` is the root entry |
| `src/storage` | `storageName`, expiry helpers, `createBrowserStorage` (aggregate of the tools' stores) |
| `src/ui` | Shared runtime: `context.tsx` (provider + hooks, incl. `useDataSource`), `DataPanel.tsx`, `runtime.tsx` (ToolboxPanel/ToolOverlays/ToolDialogs), `contracts.ts` (ToolPlugin), `owned-layers.ts`, `plugins/shared.ts`, primitives, shared `messages/` |
| `src/ui/core.ts` | `/react/core`: shared host runtime, no tool code (`/react` = `ui/index.ts` is the deprecated all-in-one) |
| `src/adapters` | MapLibre adapter, bridge, GeoJSON surface, RegistryLayers |
| `tests/tools/<tool>*.test.ts` | One tool's tests; `tests/helpers/dom.ts` is the shared DOM setup; cross-tool cases in `tests/plugins-dom.test.ts` |
| `changes/` | Change fragments collected into `CHANGELOG.md` by `npm run release` |

Team ownership and the pull request flow are in `CONTRIBUTING.md` and `.github/CODEOWNERS`.

Public entries are listed in `package.json#exports`; everything else is private. Adding a public symbol means exporting it from an entry.

## Rules

- **New tools.** Follow `docs/new-tool.md` (files, entry, export, ownership pattern, text, tests, docs). Never add tool code to `ui/core.ts`.
- **Tool boundaries.** A tool's files live in `src/tools/<tool>/` and may import shared runtime/core code and contracts but never another tool's folder or contracts, `ui/messages.ts`, `ui/index.ts` or `storage/index.ts`. `tests/tool-boundaries.test.ts` enforces this by folder; a new tool adds one ownership pattern there.
- **Text.** No literal user-facing strings in components. Add them to the component's group in `src/tools/<tool>/messages/<group>.ts` (shared runtime: `src/ui/messages/`) (Thai default, functions for interpolation), read with `useToolText("<group>", <group>Th)`, register the group in `ui/messages.ts`, and export it from the tool entry. Inside effects/async callbacks read text through a ref, don't add it to deps.
- **Colours.** Use tokens `text-[color:var(--sdk-<name>,#fallback)]`, not Tailwind palette classes (`slate-*`, `teal-*`…). The fallback is the visible default.
- **Engine neutrality.** UI and plugins use only `MapAdapter` (`project`, events, optional `geojson`/`onPointer`). Engine-specific code belongs in `src/adapters` or an example. MapLibre surface: never reorder on every `styledata` (it re-fires and MapLibre never reaches `load`).
- **Storage.** Tools get stores via `useToolStorage(kind, appId => create(storageName(appId, tool)))`. Never rename databases or change record shapes without a migration — hosts' saved data depends on them (the web passes legacy names).
- **Contracts.** `apiVersion` stays `"2.0"` unless the plugin contract breaks. Breaking changes need `bump: major` and a migration note in their change fragment. Every change adds a fragment in `changes/` (never edit `CHANGELOG.md` or the version directly); `npm run release` writes them. Keep `README.md` current.
- **Contracts.** Files in `src/contracts/` are copied byte-identical into `../toolbox_service/src/contracts/`; after changing one, run `npm run contracts:sync` there (its CI runs `contracts:check`).
- **Security.** No service keys or secrets in the SDK. Access levels/capabilities are UI gating only; servers authorize.
- Code style is compact TypeScript (dense one-liners are the house style); match neighbouring code.

## Commands

```bash
npm install            # also builds dist via prepare
npm run lint           # tsc --noEmit (strict)
npm run build          # dist/ + styles.css
npm test               # node:test; DOM tests use happy-dom 21.0.4, storage tests fake-indexeddb
```

- Consumers pick up a change only when the version changes or the installed copy is deleted first (`--install-links` copies), so the maintainer releases (`npm run release`) before the web upgrades.
- CI (`.github/workflows/ci.yml`) runs lint, tests, build and both examples on every pull request.
- After changes: typecheck and build both examples (`cd examples/<name> && rm -rf node_modules/@thaiwater/toolbox-sdk && npm install ../.. --install-links && npx tsc -p tsconfig.json --noEmit && npm run build`), reinstall in `../simple_gis_webapp`, and run its `npm run lint`, `npm run build` and tests.
- Map rendering is not covered by unit tests — check visual changes in an example or `/gis` in a browser.
- New dependencies: pin versions at least two weeks old unless a security fix requires newer, and run `npm audit`.
