# CLAUDE.md — toolbox_sdk (@thaiwater/toolbox-sdk)

Reusable Photo / Draw / Data Files / Navigation tools for React web maps laid out as three panels (Map, Layer, Toolbox). Read `README.md` (API) and `CHANGELOG.md` (contract history) before changing contracts. GitHub: bird50/webmap_toolbox_sdk, branch `main`.

## Consumers — check them when you change anything

- `../simple_gis_webapp` (ThaiWater GIS, Next.js 16, MapLibre 5) — the production host. Installs this package as a copied `file:` dependency.
- `examples/react-maplibre` (port 4174) and `examples/leaflet` (port 4175) — prove the API works on two engines.
- The service HTTP contract belongs to `../toolbox_service`; the SDK only talks to a host gateway (`PublicClient`), never to the service or its key.

## Layout

| Path | Contents |
| --- | --- |
| `src/core` | No React/engine: layers, `LayerRegistry`, `MapAdapter` + GeoJSON surface types, workspace store, `PublicClient`, zod contracts, parsers |
| `src/storage` | IndexedDB stores per tool, `storageName`, `createBrowserStorage` |
| `src/ui` | `context.tsx` (provider + hooks), `runtime.tsx` (ToolboxPanel/ToolOverlays/ToolDialogs), `contracts.ts` (ToolPlugin), tool components, `plugins/` (tool factories), `messages/` (one text group per file) |
| `src/tools/*.ts` | Per-tool public entries |
| `src/adapters` | MapLibre adapter, bridge, GeoJSON surface, RegistryLayers |

Public entries are listed in `package.json#exports`; everything else is private. Adding a public symbol means exporting it from an entry.

## Rules

- **Tool boundaries.** A tool's files may import shared runtime/core code but never another tool's files, `ui/messages.ts`, `ui/index.ts` or `storage/index.ts`. `tests/tool-boundaries.test.ts` enforces this; new tool files must be added to its ownership patterns.
- **Text.** No literal user-facing strings in components. Add them to the component's group in `src/ui/messages/<group>.ts` (Thai default, functions for interpolation), read with `useToolText("<group>", <group>Th)`, register the group in `ui/messages.ts`, and export it from the tool entry. Inside effects/async callbacks read text through a ref, don't add it to deps.
- **Colours.** Use tokens `text-[color:var(--sdk-<name>,#fallback)]`, not Tailwind palette classes (`slate-*`, `teal-*`…). The fallback is the visible default.
- **Engine neutrality.** UI and plugins use only `MapAdapter` (`project`, events, optional `geojson`/`onPointer`). Engine-specific code belongs in `src/adapters` or an example. MapLibre surface: never reorder on every `styledata` (it re-fires and MapLibre never reaches `load`).
- **Storage.** Tools get stores via `useToolStorage(kind, appId => create(storageName(appId, tool)))`. Never rename databases or change record shapes without a migration — hosts' saved data depends on them (the web passes legacy names).
- **Contracts.** `apiVersion` stays `"2.0"` unless the plugin contract breaks. Breaking changes bump the major version and get a CHANGELOG migration section. Keep `README.md` and `CHANGELOG.md` current with every release.
- **Security.** No service keys or secrets in the SDK. Access levels/capabilities are UI gating only; servers authorize.
- Code style is compact TypeScript (dense one-liners are the house style); match neighbouring code.

## Commands

```bash
npm install            # also builds dist via prepare
npm run lint           # tsc --noEmit (strict)
npm run build          # dist/ + styles.css
npm test               # node:test; DOM tests use happy-dom 21.0.4, storage tests fake-indexeddb
```

- Bump `version` for every change consumers must pick up: `--install-links` copies are only refreshed when the version changes (or the installed copy is deleted first).
- After changes: typecheck and build both examples (`cd examples/<name> && rm -rf node_modules/@thaiwater/toolbox-sdk && npm install ../.. --install-links && npx tsc -p tsconfig.json --noEmit && npm run build`), reinstall in `../simple_gis_webapp`, and run its `npm run lint`, `npm run build` and tests.
- Map rendering is not covered by unit tests — check visual changes in an example or `/gis` in a browser.
- New dependencies: pin versions at least two weeks old unless a security fix requires newer, and run `npm audit`.
