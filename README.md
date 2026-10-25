# Toolbox SDK

Reusable React/TypeScript Photo, Draw and Data Files tools with three independently mounted panels: **Map**, **Layer**, **Toolbox**. `@thaiwater/toolbox-sdk` contains no imports from ThaiWater, Next.js, Prisma or the service source. The current MapLibre renderer is shipped separately from the engine-neutral core and drawing UI.

## Build and install

Node 22.14+ and npm. Run `npm install`, `npm run lint`, `npm run build`, `npm test`. Build emits JavaScript, TypeScript declarations and CSS to `dist/` (ignored by Git). In another application: `npm install ../toolbox_sdk --install-links`. `npm pack` produces an installable archive for CI or an internal npm registry; publishing is not performed automatically.

`npm test` runs node:test suites without a browser: `sdk.test.ts` (registry, storage, client, adapter), `core-data-files.test.ts` (CSV/GeoJSON/KML parsers; `@xmldom/xmldom` stands in for the browser `DOMParser`), `core-contracts.test.ts` (drawing geometry and contract, public photo query, share tags, Host API 1.0) and `ui-smoke.test.ts` (server-rendered markup of the tool panels, `ToolboxHost`, `LayerPanel`, `WorkspacePanels`), `registry-plugins.test.ts` (owned layers, batched updates, Tool API 2.0 checks) `maplibre-surface.test.ts` (GeoJSON surface against an in-memory MapLibre stand-in, pointer events, style swaps), `workspace.test.ts` (map slot, tool state, plugin layer registration) and `runtime-dom.test.ts` (provider, panels, overlays and dialogs rendered with react-dom in happy-dom). Hooks, effects and map overlays are not exercised; check them with the host application's manual regression checklist.

```tsx
import {createPublicClient} from '@thaiwater/toolbox-sdk';
import {createBrowserStorage} from '@thaiwater/toolbox-sdk/storage';
import {ToolboxProvider,WorkspacePanels} from '@thaiwater/toolbox-sdk/react';
import '@thaiwater/toolbox-sdk/styles.css';
const runtime={appId:'my-system',storage:createBrowserStorage('my-system'),client:createPublicClient()};
// Mount once above your toolbox panels and map overlays.
<ToolboxProvider runtime={runtime}>
  <WorkspacePanels map={mapView} layer={layerView} toolbox={toolboxView}/>
</ToolboxProvider>
```

Map, Layer and Toolbox are slots: applications decide placement, dimensions, visibility and their own UI. `LayerPanel` is an optional reference UI backed by `createLayerRegistry` / `useLayerRegistry`. Register/remove/reorder layers there; both Layer and Toolbox controls must use the same registry. `WorkspacePanels` handles narrow screens; applications can replace it completely. CSS does not import Tailwind preflight. Import the supplied CSS in apps without Tailwind; existing Tailwind apps may scan `src/ui` and `src/adapters` instead. Theme and placement variables include `--sdk-primary`, `--sdk-font`, `--sdk-settings-right`, `--sdk-settings-top`, `--sdk-drawing-right` and `--sdk-drawing-top`.

## Entry points

| Import | Responsibility |
| --- | --- |
| package root | Core layer/map contracts, registry, public client and validation |
| `/react` | Provider, panels, ToolHost, Photo/Draw/Data Files UI and per-tool service types |
| `/maplibre` | MapLibre bridge/adapter, PhotoLayers, RegistryLayers |
| `/storage` | Browser storage factories with app namespaces |
| `/core/drawing`, `/core/data-files`, `/core/photo-gps` | Geometry, file parsers and EXIF helpers |

Core does not import React or a map engine. Photo markers/popups currently require the MapLibre renderer; to use another engine implement `MapAdapter` plus an equivalent photo/GeoJSON renderer. DrawingWorkspace uses only the adapter, and its SVG overlay preserves text, styles, arrows and rotation. MapLibre peer dependencies are optional for core-only clients. New installations should use a patched MapLibre 6.x; 5.x compatibility exists for existing hosts and does not resolve their upstream security advisories.

Inside a react-map-gl Map mount `<MapLibreToolboxBridge>` around drawing and photo overlays. The bridge owns subscriptions, disposes its own listeners on unmount and never destroys the host map. A different engine mounts `<MapAdapterProvider adapter={adapter}>`. The adapter provides viewport, projection, navigation, bounds fitting and events. Optional `WebmapHost.map` / `.registry` extend the compatible API 1.0; tools declare capabilities they need. UI access levels are presentation only, never server authorization.

## Tool API 2.0 preview (0.2.0, additive)

These contracts land ahead of the plugin runtime; nothing mounts them yet and every 1.0 API keeps working unchanged.

- `LayerDefinition.owner {toolId,key}` marks tool-owned layers; `photoDataKey`/`drawingDataKey` are deprecated and stay for 1.0 hosts. `isToolLayer()` accepts either form.
- `LayerRegistry.registerOwned(toolId, layers, placement)` adds a tool's layers all-or-nothing with one change event (`'start'`, `'end'` or `{before:id}`); `unregisterOwner(toolId)` removes them; `update({visible,opacity})` batches changes and skips no-ops. `useLayerRegistry` setters now emit once per call.
- `MapAdapter` gains optional `onPointer`/`offPointer` (`click`, `pointermove`; hits are reported by registry layer ID), `getContainer()` for HTML/SVG overlays and a `geojson` surface (`set`, `remove`, `setVisible`, `setOpacity`, `order` first = top, `layerIds`). `mapCapabilities(adapter)` derives `map.pointer`, `map.geojson` and `map.overlay` from what an adapter actually implements; custom adapters without them stay valid.
- The MapLibre adapter implements all three. Its GeoJSON surface re-adds layers after a basemap/style swap and reuses RegistryLayers IDs and paint (`registryLayerSpecs`), so never render one registry layer through both. Layers missing from the last `order()` call sit below ordered ones.
- `ToolPlugin` (`apiVersion:"2.0"`, `layers`, `Panel`, `Overlay`, `Dialogs`), `pluginAvailable()` and `definePlugins()` (unique tool IDs, one owner per layer ID) describe self-contained tools for the upcoming runtime.

## Tool API 2.0 runtime (0.3.0, additive)

```tsx
<ToolboxProvider runtime={runtime} registry={registry} plugins={plugins} user={{id:userId,accessLevel}} toolLayers="start">
  <Map>…<MapLibreToolboxBridge><ToolOverlays/></MapLibreToolboxBridge></Map>  {/* Map Panel */}
  <LayerPanel registry={registry}/>                                              {/* Layer Panel, or the host's own UI via useLayers() */}
  <ToolboxPanel/>                                                                {/* Toolbox Panel */}
  <ToolDialogs/>
</ToolboxProvider>
```

- `ToolboxProvider` without `plugins` behaves exactly as before. With plugins it validates them (`definePlugins`), mounts those allowed by `user.accessLevel` and the capabilities in effect (`layers.control`, `layers.register`, plus `map.navigate` and `mapCapabilities()` once a map adapter is attached, plus any host `capabilities`), and registers each mounted tool's `layers` via `registerOwned` at the `toolLayers` end of the list, removing them when the tool or provider unmounts.
- A tool whose layer IDs clash with the host's is not mounted and `ToolboxPanel` shows a notice; a tool that throws while rendering is replaced by a notice. Other tools keep working.
- Every Panel, Overlay and Dialogs component is wrapped in `ToolScope` and receives `{toolId}`. Inside a tool: `useToolState(key, initial)` is a useState shared by that tool's components for the provider's lifetime; `useToolLayers()`, `useLayer(id)` and `useLayers()` read and change the shared registry; `useToolUser()` gives the storage identity; `useMapAdapter()` returns the map in scope or the one attached to the workspace (undefined until ready); `useToolMessages()` gives runtime text.
- `MapAdapterProvider` and `MapLibreToolboxBridge` attach their adapter to the surrounding provider automatically; `ToolOverlays` renders nothing until a map is in scope.
- `messages` overrides runtime text (`thMessages` is the default). Keep `plugins`, `registry` and `messages` stable and remount the provider (`key={user.id}`) when the identity changes.

## Storage and service

My Photos, My Drawing and Data Files stay in IndexedDB. Database names contain appId/tool/schema version; records are scoped to userId. Photo retention is 15 days from add; drawing retention is 15 days from explicit save. Reads do not extend expiry. `createBrowserStorage(appId, legacyNames)` preserves an existing host's databases without uploading or silently migrating them. Keep runtime instances stable, and remount a workspace on identity changes.

`PublicClient` talks to the host gateway (`/api/photo-shares`, `/api/public/photos`, `/api/drawing-shares`, `/api/public/drawings` by default). Configure `baseUrl`, endpoint paths or an injected fetch function. Requests preserve AbortSignals. Instance-scoped refresh events prevent unrelated apps from sharing event listeners. No service key is accepted or stored by the browser SDK. Your backend must check session/origin/access and then call Toolbox Service using its secret. The service can be deployed separately per application. Sharing a service between organizations requires tenant-aware server authorization; this SDK alone does not implement multi-tenancy.

Third-party URLs require appropriate gateway CORS/cookie handling. Prefer same-origin proxies; configure a fetch adapter for cross-origin authentication. Never expose TOOLBOX_SERVICE_KEY to the browser.

## Independent example

`examples/react-maplibre` imports this package only, never the ThaiWater source. It has Map, Layer and Toolbox panels, local Photo/Draw/Data Files workflows and configurable public calls.

```bash
cd examples/react-maplibre
npm install --install-links
npm run build
npm run dev
```

Open http://localhost:4174. The map uses a blank background so it needs no tile API key or network tiles. Navigation and drawing coordinates are real WGS84. Public endpoints are intentionally not included in this frontend-only example: mount it behind a same-origin gateway, or pass `?gateway=https://your-gateway.example` and configure that gateway's CORS/authentication. Local tools work while the public service is unavailable.

## Compatibility and release discipline

Package version: 0.3.0; host contract: 1.0 (stable) and Tool API 2.0 (preview, runtime available); storage schema: v1; service HTTP contract remains unchanged. Treat each as a separate version. Change contracts with tests and a migration note. `tests/sdk.test.ts` exercises app/user isolation, expiry, blob persistence, layer synchronization, event cleanup and endpoint configuration. Do not load unreviewed toolbox JavaScript from arbitrary URLs.

Layer ordering controls GeoJSON MapLibre layers within their rendering surface. Photo markers and the SVG drawing overlay retain separate surfaces; ordering these across surfaces requires a host-specific compositing policy.
