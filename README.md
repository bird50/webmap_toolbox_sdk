# Toolbox SDK

Reusable React/TypeScript Photo, Draw and Data Files tools with three independently mounted panels: **Map**, **Layer**, **Toolbox**. `@thaiwater/toolbox-sdk` contains no imports from ThaiWater, Next.js, Prisma or the service source. The current MapLibre renderer is shipped separately from the engine-neutral core and drawing UI.

## Build and install

Node 22.14+ and npm. Run `npm install`, `npm run lint`, `npm run build`, `npm test`. Build emits JavaScript, TypeScript declarations and CSS to `dist/` (ignored by Git). In another application: `npm install ../toolbox_sdk --install-links`. `npm pack` produces an installable archive for CI or an internal npm registry; publishing is not performed automatically.

`npm test` runs node:test suites without a browser: `sdk.test.ts` (registry, storage, client, adapter), `core-data-files.test.ts` (CSV/GeoJSON/KML parsers; `@xmldom/xmldom` stands in for the browser `DOMParser`), `core-contracts.test.ts` (drawing geometry and contract, public photo query, share tags, Host API 1.0) and `ui-smoke.test.ts` (server-rendered markup of the tool panels, `ToolboxHost`, `LayerPanel`, `WorkspacePanels`). Hooks, effects and map overlays are not exercised; check them with the host application's manual regression checklist.

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

Package version: 0.1.2; host contract: 1.0; storage schema: v1; service HTTP contract remains unchanged. Treat each as a separate version. Change contracts with tests and a migration note. `tests/sdk.test.ts` exercises app/user isolation, expiry, blob persistence, layer synchronization, event cleanup and endpoint configuration. Do not load unreviewed toolbox JavaScript from arbitrary URLs.

Layer ordering controls GeoJSON MapLibre layers within their rendering surface. Photo markers and the SVG drawing overlay retain separate surfaces; ordering these across surfaces requires a host-specific compositing policy.
