# Toolbox SDK

Reusable Photo, Draw and Data Files tools for any React web map laid out as three panels: **Map**, **Layer**, **Toolbox**, plus an optional **Data** panel (attribute table and chart). Each tool is a plugin that owns its layers, state, map overlay and dialogs; the host supplies the map (through a `MapAdapter`), the layer registry and the gateway. `@thaiwater/toolbox-sdk` contains no imports from ThaiWater, Next.js, Prisma or the service source, and its tools run on any engine with an adapter (MapLibre ships with the package; `examples/leaflet` shows Leaflet).

## Build and install

Node 22.14+ and npm. Run `npm install`, `npm run lint`, `npm run build`, `npm test`. Build emits JavaScript, TypeScript declarations and CSS to `dist/` (ignored by Git). In another application: `npm install ../toolbox_sdk --install-links` (npm only refreshes the copied package when its version changes). `npm pack` produces an installable archive for CI or an internal npm registry; publishing is not performed automatically.

`npm test` runs node:test suites without a browser: registry/storage/client/adapter (`sdk.test.ts`), CSV/GeoJSON/KML parsers (`core-data-files.test.ts`, with `@xmldom/xmldom` standing in for `DOMParser`), drawing geometry and contracts (`core-contracts.test.ts`), tool panel markup (`ui-smoke.test.ts`), owned layers and capabilities (`registry-plugins.test.ts`), the MapLibre GeoJSON surface against an in-memory stand-in (`maplibre-surface.test.ts`), the workspace store (`workspace.test.ts`), and the provider and built-in plugins rendered with react-dom in happy-dom (`runtime-dom.test.ts`, `plugins-dom.test.ts`). Real map rendering is checked with the example apps and the host's manual regression checklist.

## Quick start

```tsx
import {createLayerRegistry,createPublicClient} from '@thaiwater/toolbox-sdk';
import {createBrowserStorage} from '@thaiwater/toolbox-sdk/storage';
import {ToolboxProvider,ToolboxPanel,ToolOverlays,ToolDialogs,LayerPanel} from '@thaiwater/toolbox-sdk/react/core';
import {photoTool} from '@thaiwater/toolbox-sdk/tools/photo';                // only the tools this app uses
import {navigationTool} from '@thaiwater/toolbox-sdk/tools/navigation';
import {MapLibreToolboxBridge} from '@thaiwater/toolbox-sdk/maplibre';
import '@thaiwater/toolbox-sdk/styles.css';

const runtime={appId:'my-system',storage:createBrowserStorage('my-system'),client:createPublicClient()};
const registry=createLayerRegistry(systemLayers,'MEMBER');            // module-level or useState: keep stable
const plugins=[photoTool(),navigationTool()];

<ToolboxProvider runtime={runtime} registry={registry} plugins={plugins} user={{id:userId,accessLevel:'MEMBER'}} toolLayers="start">
  <Map>…<MapLibreToolboxBridge><ToolOverlays/></MapLibreToolboxBridge></Map>   {/* Map Panel */}
  <LayerPanel registry={registry}/>                                             {/* Layer Panel, or your own UI via useLayers() */}
  <ToolboxPanel/>                                                               {/* Toolbox Panel */}
  <ToolDialogs/>
</ToolboxProvider>
```

Map, Layer and Toolbox are slots: the host decides placement, dimensions and visibility (`WorkspacePanels` is an optional reference layout). Keep `plugins`, `registry` and `messages` stable and remount the provider (`key={user.id}`) when the identity changes. Access levels are presentation only, never server authorization.

## Entry points

| Import | Responsibility |
| --- | --- |
| package root | Layer/map contracts, `createLayerRegistry`, workspace store, public client, drawing/photo-share/public-query contracts |
| `/react/core` | Shared host runtime, no tool code: `ToolboxProvider`, `ToolboxPanel`/`ToolOverlays`/`ToolDialogs`, `DataPanel`, hooks, plugin contracts, `WorkspacePanels`/`LayerPanel` |
| `/react` | Deprecated all-in-one: `/react/core` plus every built-in tool, tool UI component and `thMessages` |
| `/maplibre` | `createMapLibreAdapter`, `MapLibreToolboxBridge`, MapLibre GeoJSON surface, `RegistryLayers` |
| `/storage` | Browser storage factories with app namespaces, `storageName`, `formatExpiry` |
| `/tools/photo`, `/tools/draw`, `/tools/data-files`, `/tools/navigation` | One tool each: plugin factory, its UI components, store factory and text defaults |
| `/core/drawing`, `/core/data-files`, `/core/photo-gps` | Geometry, file parsers and EXIF helpers |
| `/styles.css` | Utilities and tokens for hosts without Tailwind |

Only these paths are public API; files under `dist/` are not importable individually.

An app imports the shared runtime from `/react/core` and each tool it uses from its own entry (`import {photoTool} from '@thaiwater/toolbox-sdk/tools/photo'`), so tools it does not list are not bundled. The package declares `sideEffects` (only CSS), so bundlers drop unused modules; a build that uses only `navigationTool` contains no photo, draw or data-files code. A tool entry pulls in the shared runtime and its own files only — never another tool, the all-in-one message table or `createBrowserStorage` — and `tests/tool-boundaries.test.ts` enforces this, so each tool can later become its own package without code changes. `tests/tool-boundaries.test.ts` also keeps `/react/core` free of tool files. `/react` still exports everything for existing apps and is deprecated. To add a tool, follow [docs/new-tool.md](docs/new-tool.md).

## Data Panel

`<DataPanel/>` shows rows offered with `useDataSource({id,title,layerId,features,columns?,labels?,loading?,error?,note?})`, one tab per source whose layer is visible, in registry order. Data Files offers each set on the map automatically; a host offers its own layers the same way (keep `features` referentially stable, e.g. from state or `useMemo`). The panel has search, 100-row pages, and a chart view: a histogram for numeric columns (numbers or numeric strings such as `"1,250"`) or the top 10 categories otherwise. Clicking a row moves the map to the feature; pass `onSelect(feature,source)` to open your own popup instead, and `selected` to highlight it. The host decides where it sits and how tall it is (`WorkspacePanels data` puts it below the map). Rows are what the source holds: bound large layers (bbox queries, limits) before offering them.

## Map adapters

A `MapAdapter` provides size, zoom, bounds, `project`/`unproject`, `navigate`, `fitBounds` and `move`/`moveend`/`resize`/`load` events. Optional parts unlock more capabilities, which `mapCapabilities(adapter)` derives automatically:

| Optional member | Capability | Used by |
| --- | --- | --- |
| `onPointer`/`offPointer` (`click`, `pointermove`; GeoJSON hits by registry layer ID) | `map.pointer` | host identify |
| `getContainer()` | `map.overlay` | — |
| `geojson` surface (`set`, `remove`, `setVisible`, `setOpacity`, `order` first = top, `layerIds`) | `map.geojson` | Data Files |

Drawing and photo overlays are HTML/SVG positioned with `project`, so they need no engine-specific code. Inside react-map-gl mount `<MapLibreToolboxBridge>` (it attaches its adapter to the provider and never destroys the host map); any other engine mounts `<MapAdapterProvider adapter={adapter}>` around `ToolOverlays`. The MapLibre GeoJSON surface re-adds layers after basemap/style swaps, reuses `RegistryLayers` IDs and paint (`registryLayerSpecs`), and only reorders after something was re-added or the order changed (reordering on every `styledata` would keep MapLibre from ever firing `load`). Layers missing from the last `order()` call sit below ordered ones; HTML/SVG overlays sit above engine layers.

## Built-in tools

| Factory | Layers (owner key → default ID) | Requires |
| --- | --- | --- |
| `dataFilesTool()` | none up front; `file` → `my-data-files/<setId>`, `public` → `public-data-files/<shareId>` at runtime | `map.geojson` |
| `drawTool()` | `mine` → `my-drawing/<setId>` (template `mine`) and `public` → `public-drawing/<shareId>` (template `shared`), one layer per set added to the map; no static layers | `map.viewport`, `map.project`, `map.events` |
| `photoTool()` | `event` → `my-photos/<eventId>` (template `mine`) and `set` → `public-photos/<shareId>` (template `shared`), one layer per set added to the map; no static layers | `map.viewport`, `map.project`, `map.events` |

Photos are chosen straight into event sets in the browser (a required name, tags, 1–10 photos with GPS; photos can be added or removed later, and a photo left in no set is deleted). Each set added with **Add to map** becomes its own layer "My Photos/<event name>" (hide it in the layer list, or delete the set to remove it); **Save to Public** uploads a set as one share. Public Photos has no viewport layer: its settings button opens a search of Public photo sets (`GET /api/public/photo-shares`, filters AND, newest first, 20 per page); each set has **Add to map**, which reads the set (`GET /api/photo-shares/<id>`) and adds the layer "Public Photos/<set name>". Added sets are remembered in this browser (localStorage, IDs and names only) and dropped when the service no longer has them. Draw works like Photo: the Drawing Toolbar draws on a draft kept in this browser, **Save ชุดรูปวาด** stores it as a named set (name required, tags) with its own layer "My Drawing/<name>"; the My Drawing dialog adds/removes sets on the map, renames them, reopens their drawings on the toolbar, saves them to Public (with tags and the automatic `shareYYYY-MM-DD` tag) or deletes them. Public Drawing searches published sets (`GET /api/public/drawing-shares`) and adds each as "Public Drawing/<name>". Drawing layers appear in the Data Panel (a row per object). Data Files works the same way: a KML/GeoJSON/CSV file is saved as a named set (name required, description, tags) with its own layer "My Data Files/<name>"; the My Data Files dialog adds/removes sets on the map, edits them (and can replace their data with a new file), saves them to Public once or deletes them, and Public Data Files searches published sets (`GET /api/public/data-file-shares`) and adds each as "Public Data Files/<name>". Each data file layer is a Data Panel source. Host Layer Panels can show a − button from `useLayerRemove(layerId)` for layers a tool can take off the map (`useLayerRemover`); the photo tool offers it for every set layer. Visible photo layers appear in the Data Panel (a row per photo); clicking a photo name zooms to it and opens its popup. Each photo can carry a caption (up to 500 characters) that is shown in its popup and sent with Save to Public. Toolbox Service 1.3 stores the app name (gateway header `x-toolbox-app-name`) and the app user (`x-toolbox-username`, `anonymous` when absent) with every share.
| `navigationTool({home})` | none | `map.navigate` |

Factories take `id`, `title`, `accessLevel` and per-layer overrides (`layer`, `mine`, `shared`): any `LayerDefinition` field, or `false` to drop that layer. `createPhotoTool(Overlay, requires, options)` swaps the photo renderer. Tool layers are filtered by the registry's access level like any layer, so a `PUBLIC` registry hides the `MEMBER` "My …" layers.

## Writing a tool

A `ToolPlugin` has `id`, `title`, `version`, `apiVersion:"2.0"`, `accessLevel`, `requires`, optional `layers` (registered with `owner.toolId` while the tool is mounted), `Panel`, `Overlay` (inside the map), `Dialogs`, a headless `Controller` for shared effects (storage, timers, object URLs) and `layerSettings` (owner key → dialog name). The provider mounts tools whose access level and capabilities are met; a tool whose layer IDs clash with the host's is not mounted and `ToolboxPanel` says so, and a tool that throws while rendering is replaced by a notice.

Inside a tool: `useToolState(key, initial)` (state shared by the tool's components), `useToolDialog(name)` (one dialog open at a time across the workspace; `returnFocus` is the opener), `useToolLayers()`, `useLayer(id)`, `useLayers()`, `useMapAdapter()`, `useToolUser()`, `useToolMessages()`. Hosts use `useLayerSettings(layerId)` for settings buttons in their Layer Panel and tool-specific hooks such as `useDrawingToolbar()`.

## Text and theme

All UI text comes from per-component groups (`photoSettings`, `drawingToolbar`, `dataFilesTool`, …); each tool entry exports its own Thai defaults and components read their group with `useToolText(group, defaults)`. `thMessages`/`useToolMessages()` in `/react` still give the full merged set. Pass `ToolboxProvider messages={{dataFilesTool:{title:'Data files'}}}`: each group may be partial and is merged over the Thai defaults. Validation errors raised by core parsers and storage remain Thai and reach the UI as `Error.message`.

Colours are CSS variables with the previous defaults as fallbacks: `--sdk-primary`, `--sdk-primary-soft`, `--sdk-primary-strong`, `--sdk-ring`, `--sdk-muted`, `--sdk-muted-strong`, `--sdk-text-secondary`, `--sdk-border`, `--sdk-border-subtle`, `--sdk-surface-muted`, `--sdk-warning`, `--sdk-danger`, `--sdk-info` and a few soft variants. Placement and font: `--sdk-font`, `--sdk-settings-right`, `--sdk-settings-top`, `--sdk-drawing-right`, `--sdk-drawing-top`. CSS does not import Tailwind preflight; import `styles.css` in apps without Tailwind, or let a Tailwind host scan `src/ui` and `src/adapters`.

## Storage and service

`runtime.storage` is optional and may be partial: a tool without a configured store opens its default database `storageName(appId, tool)` (`toolbox:<appId>:photo|draw|files:v1`, the same names `createBrowserStorage` uses), once per runtime. Pass explicit stores (or `createBrowserStorage(appId, legacyNames)`) to keep existing database names.

My Photos, My Drawing and Data Files stay in IndexedDB. Database names contain appId/tool/schema version; records are scoped to userId. The photo database is at IndexedDB version 2 (photos + event sets) and the drawing database at version 2 (draft + drawing sets); version 1 databases upgrade in place. Photo retention is 15 days from add; a drawing set keeps 15 days from its last save. Reads do not extend expiry. `createBrowserStorage(appId, legacyNames)` preserves an existing host's databases without uploading or silently migrating them.

`PublicClient` talks to the host gateway (`/api/photo-shares`, `/api/photo-shares/<id>`, `/api/public/photo-shares`, `/api/public/photos`, `/api/drawing-shares`, `/api/drawing-shares/<id>`, `/api/public/drawing-shares`, `/api/public/drawings`, `/api/data-file-shares`, `/api/data-file-shares/<id>`, `/api/public/data-file-shares`, `/api/public/data-files` by default). Photos, drawings and data files are published the same way: an explicit Save to Public of a set with a name/event, description where it applies, an automatic `shareYYYY-MM-DD` tag and up to 10 tags. Configure `baseUrl`, endpoint paths or an injected fetch function. Requests preserve AbortSignals. Instance-scoped refresh events prevent unrelated apps from sharing event listeners. No service key is accepted or stored by the browser SDK. Your backend must check session/origin/access and then call Toolbox Service using its secret. Toolbox Service 1.1 issues one key per app (`npm run key:create`) and keeps each app's shares separate; give every app its own key. Give the gateway two keys: scope `read` for the GETs behind public layers and share pages, and `read,write` only for publishing (Save to Public of photos, drawings and data files). Data file sets reach the service only through Save to Public. Prefer same-origin proxies; never expose TOOLBOX_SERVICE_KEY to the browser.

## Examples

Both examples import this package only and use a blank background, so they need no tile key. Public endpoints are not included: run behind a same-origin gateway or pass `?gateway=https://your-gateway.example`; local tools work without it.

```bash
cd examples/react-maplibre   # or examples/leaflet
npm install ../.. --install-links
npm run build
npm run dev
```

MapLibre: http://localhost:4174 (the build copies MapLibre 6's worker next to the bundle). Leaflet: http://localhost:4175 (`leaflet-adapter.ts` is a complete `MapAdapter` with a GeoJSON surface and pointer hits).

## Compatibility

Package 1.4.0; Tool API 2.0; storage schema v1; service HTTP contract unchanged. Treat each as a separate version and change contracts with tests and a migration note (see `CHANGELOG.md`). Do not load unreviewed toolbox JavaScript from arbitrary URLs.
