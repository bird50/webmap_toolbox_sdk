# Adding a tool

A tool is a `ToolPlugin` (`src/ui/contracts.ts`) living in its own folder `src/tools/<tool>/` with its own entry. Apps list the tools they want in `ToolboxProvider plugins`; a tool that is not listed is never mounted, never registers layers, never opens storage and — because apps import tools from `/tools/*` and the package declares `sideEffects` — is not bundled. Use `navigationTool` (`src/tools/navigation/`) as the smallest example and `photoTool` (`src/tools/photo/`) as the full one (layers created at runtime, storage, dialogs, Data Panel rows, layer removal).

The examples below add a tool called `foo`. Everything it owns sits in `src/tools/foo/`, so one developer can own the folder (see `CONTRIBUTING.md`).

## Files

| File | Contents |
| --- | --- |
| `src/tools/foo/index.ts` | The public entry: `"use client";` and exports of the factory, the components a host may reuse, the store factory and every `foo*Th` |
| `src/tools/foo/plugin.tsx` | `fooTool(options)` returning a `ToolPlugin`, plus its `Controller`, `Panel`, `Overlay`, `Dialogs` |
| `src/tools/foo/Foo*.tsx`, `FooTool.tsx` | The tool's components (name them `Foo…`) |
| `src/tools/foo/messages/foo*.ts` | One Thai text group per component: `export const fooPanelTh={…}` and `export type FooPanelMessages=typeof fooPanelTh` |
| `src/tools/foo/foo-storage.ts` | Only if it keeps browser data: IndexedDB store factory (`createFooStorage(databaseName)`), records scoped by `userId` |
| `src/tools/foo/*.ts` | Parsers, geometry and other code only this tool uses |
| `src/contracts/foo-*.ts` | Only if it has a server contract: zod schemas shared with the gateway and `../toolbox_service`. Import only `zod` and other files in `src/contracts/`; the service copies the folder with `npm run contracts:sync` |
| `tests/tools/foo.test.ts` | DOM tests (setup from `tests/helpers/dom.ts`) and unit tests of the tool |

## Wiring

1. `package.json#exports`: add `"./tools/foo"` pointing at `dist/tools/foo/index.{js,d.ts}` (copy an existing tool's block).
2. `tests/tool-boundaries.test.ts`: add `foo:/^(tools\/foo\/.*|contracts\/foo-[\w-]+)\.tsx?$/` to `owners`. The test then fails if `tools/foo` imports another tool or an all-in-one barrel, and if `/react/core` imports any `foo` file.
3. `src/ui/messages.ts`: register each group in `thMessages` (the deprecated all-in-one table) — never import `ui/messages.ts` from the tool.
4. Optional, for the deprecated `/react`: export the factory from `src/ui/index.ts`. Do **not** touch `src/ui/core.ts`.
5. `.github/CODEOWNERS`: add `/src/tools/foo/`, `/src/contracts/foo-*` and `/tests/tools/foo*` with the tool's owner.

## Rules

- **Identity.** Default `id` like `"toolbox.foo"`; accept `ToolPluginOptions` (`id`, `title`, `accessLevel`) so a host can keep legacy IDs (the web uses `thaiwater.*`).
- **Layers** come from the plugin only: static ones in `layers` via `toolLayer(id,key,defaults,options)` (`src/ui/plugins/shared.ts`), runtime ones with `useOwnedLayers(key,template,items,…)` like the photo, draw and data file sets. Hosts never put tool layer IDs in their own config. Offer `layerSettings` (key → dialog name) for a settings button and `useLayerRemover(key,remove)` for a − button.
- **State** shared by the tool's components: `useToolState(key,initial)`. Loading, timers and subscriptions live in `Controller`.
- **Storage**: `useToolStorage(kind, appId => createFooStorage(storageName(appId,"foo")))`. Never rename a database or change a record shape without an IndexedDB upgrade.
- **Map** only through `MapAdapter` (`useMapAdapter()`, `useToolboxMap()` inside overlays). Declare what it needs in `requires` (`"map.geojson"`, `"map.project"`, …); a host without the capability simply does not mount the tool.
- **Text** through `useToolText("fooPanel", fooPanelTh)`; colours through `--sdk-*` tokens; no literal strings or palette classes.
- **Data Panel**: offer rows with `useDataSource({id,title,layerId,features,columns,labels,select?})`.
- **Server**: the browser talks only to the host gateway through `PublicClient` (add a path there if needed); the gateway holds the service key and validates input with the shared zod contract. The service gets a module `src/modules/foo.ts` with its own routes and migrations.
- **Dependencies** used by one tool only: import them lazily (`await import("exifr")`) or pick the smallest package (`@turf/bbox`, not `@turf/turf`).
- **Shared code.** Need something new in `src/ui`, `src/core`, `src/storage`, `src/adapters` or a shared contract (`share-tags`, `public-photo-query`)? Change it in its own pull request first (the maintainer reviews it), then use it from the tool.

## Tests and release

- `tests/tools/foo.test.ts` (happy-dom + fake-indexeddb): mount `ToolboxProvider` with only `fooTool()` and exercise Panel, Dialogs, layers and storage. Keep cross-tool cases in `tests/plugins-dom.test.ts`.
- `npm run lint`, `npm run build`, `npm test`; build both examples.
- Add a change fragment `changes/foo-<slug>.md` (`bump: minor` for a new tool) and a row in README's entry table; do not edit `CHANGELOG.md` or the version (see `changes/README.md`).
- In the host: import `fooTool` from `@thaiwater/toolbox-sdk/tools/foo`, add it to the plugin list, add gateway routes if it publishes, and reinstall the SDK (stop dev, remove `node_modules/@thaiwater/toolbox-sdk` and `.next/dev`, `npm install ../toolbox_sdk --install-links`).
