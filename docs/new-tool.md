# Adding a tool

A tool is a `ToolPlugin` (`src/ui/contracts.ts`) with its own entry. Apps list the tools they want in `ToolboxProvider plugins`; a tool that is not listed is never mounted, never registers layers, never opens storage and — because apps import tools from `/tools/*` and the package declares `sideEffects` — is not bundled. Use `navigationTool` (`src/ui/plugins/navigation.tsx`) as the smallest example and `photoTool` as the full one (layers created at runtime, storage, dialogs, Data Panel rows, layer removal).

The examples below add a tool called `foo`.

## Files

| File | Contents |
| --- | --- |
| `src/ui/plugins/foo.tsx` | `fooTool(options)` returning a `ToolPlugin`, plus its `Controller`, `Panel`, `Overlay`, `Dialogs` |
| `src/ui/Foo*.tsx`, `src/ui/tools/FooTool.tsx` | The tool's components (name them `Foo…`) |
| `src/ui/messages/foo*.ts` | One Thai text group per component: `export const fooPanelTh={…}` and `export type FooPanelMessages=typeof fooPanelTh` |
| `src/storage/foo-storage.ts` | Only if it keeps browser data: IndexedDB store factory (`createFooStorage(databaseName)`), records scoped by `userId` |
| `src/core/foo-*.ts` | Only if it has a server contract: zod schemas shared with the gateway and `../toolbox_service` (copied byte-identical there) |
| `src/tools/foo.ts` | The public entry: `"use client";` and exports of the factory, the components a host may reuse, the store factory and every `foo*Th` |

## Wiring

1. `package.json#exports`: add `"./tools/foo"` pointing at `dist/tools/foo.{js,d.ts}` (copy an existing tool's block).
2. `tests/tool-boundaries.test.ts`: add `foo:/^(ui\/plugins\/foo|ui\/Foo\w+|ui\/tools\/FooTool|storage\/foo-storage|core\/foo-\w+|ui\/messages\/foo\w*)\.tsx?$/` to `owners`. The test then fails if `tools/foo` imports another tool or an all-in-one barrel, and if `/react/core` imports any `foo` file.
3. `src/ui/messages.ts`: register each group in `thMessages` (the deprecated all-in-one table) — never import `ui/messages.ts` from the tool.
4. Optional, for the deprecated `/react`: export the factory from `src/ui/index.ts`. Do **not** touch `src/ui/core.ts`.

## Rules

- **Identity.** Default `id` like `"toolbox.foo"`; accept `ToolPluginOptions` (`id`, `title`, `accessLevel`) so a host can keep legacy IDs (the web uses `thaiwater.*`).
- **Layers** come from the plugin only: static ones in `layers` via `toolLayer(id,key,defaults,options)` (`plugins/shared.ts`), runtime ones with `registry.registerOwned(toolId,…)` like the photo sets. Hosts never put tool layer IDs in their own config. Offer `layerSettings` (key → dialog name) for a settings button and `useLayerRemover(key,remove)` for a − button.
- **State** shared by the tool's components: `useToolState(key,initial)`. Loading, timers and subscriptions live in `Controller`.
- **Storage**: `useToolStorage(kind, appId => createFooStorage(storageName(appId,"foo")))`. Never rename a database or change a record shape without an IndexedDB upgrade.
- **Map** only through `MapAdapter` (`useMapAdapter()`, `useToolboxMap()` inside overlays). Declare what it needs in `requires` (`"map.geojson"`, `"map.project"`, …); a host without the capability simply does not mount the tool.
- **Text** through `useToolText("fooPanel", fooPanelTh)`; colours through `--sdk-*` tokens; no literal strings or palette classes.
- **Data Panel**: offer rows with `useDataSource({id,title,layerId,features,columns,labels,select?})`.
- **Server**: the browser talks only to the host gateway through `PublicClient` (add a path there if needed); the gateway holds the service key and validates input with the shared zod contract.
- **Dependencies** used by one tool only: import them lazily (`await import("exifr")`) or pick the smallest package (`@turf/bbox`, not `@turf/turf`).

## Tests and release

- A DOM test in `tests/plugins-dom.test.ts` (happy-dom + fake-indexeddb): mount `ToolboxProvider` with only `fooTool()` and exercise Panel, Dialogs, layers and storage.
- `npm run lint`, `npm run build`, `npm test`; build both examples.
- Bump the minor version, add a CHANGELOG section and a row in README's entry table.
- In the host: import `fooTool` from `@thaiwater/toolbox-sdk/tools/foo`, add it to the plugin list, add gateway routes if it publishes, and reinstall the SDK (stop dev, remove `node_modules/@thaiwater/toolbox-sdk` and `.next/dev`, `npm install ../toolbox_sdk --install-links`).
