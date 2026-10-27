# Changelog

## 1.4.0

Photo event sets: photos are grouped into events in the browser before they reach the map or the server.

- My Photos dialog: **Save ชุดเหตุการณ์** stores a named set (name required, 1–10 photos, tags) in this browser. Each set has **Add to map** (shows the set and zooms to it; there is no hide button, so hide the My Photos layer or delete the set), **เพิ่ม-ลบรูป / ข้อความ** (`PhotoEventActions.setPhotos`, `setCaption`), **Save to Public** (uploads the set once with its name and tags; the result link is kept, later photo edits do not change the Public copy) and delete (photos stay in My Photos). `PhotoEvents`, text group `photoEvents`.
- Photo captions: `StoredPhoto.caption` (optional, up to `MAX_PHOTO_CAPTION` = 500 characters, `photoCaption`/`photoCaptions` in `core/photo-share`), typed when adding photos and edited in a set's editor (`storage.photos.setCaption`). Shown in the map popup (`MapPhoto.caption`) and sent with Save to Public as multipart `captions` (JSON array in photo order); Toolbox Service 1.3 stores and returns it.
- The My Photos layer draws only photos of sets added to the map (`photosOnMap`, `usePhotoToolState().photos`); adding photos no longer moves the map.
- Photo storage schema v2 (IndexedDB version 2): an `events` store plus `saveEvent`/`updateEvent`/`deleteEvent`; `loadPhotos` also returns `events` and drops expired photos from them. Upgrading puts each user's existing photos in one set, `LEGACY_PHOTO_EVENT`, already on the map, so nothing disappears.
- `PhotoSettings` without `events`/`eventActions` keeps the 1.x direct share form.

## 1.3.1

- KML from Google Earth/ArcGIS imports: prefixes used but not declared (typically `xsi:schemaLocation`) are declared before parsing, since browsers reject such files ("ไฟล์ KML ไม่ถูกต้อง").
- KML attributes become properties: ExtendedData `Data`/`SimpleData` and the two-column HTML attribute table in `description` (read as text, never rendered). A description that only holds that table is dropped; other HTML descriptions are kept as plain text.

## 1.3.0

Public sharing for Data Files, like photos and drawings. Needs Toolbox Service 1.2 and gateway routes for `/api/data-file-shares` (POST) and `/api/public/data-files` (GET).

- My Data Files dialog: **Share Public** per file with name, description, the automatic `shareYYYY-MM-DD` tag and up to 10 tags (`DataFileShare`, text group `dataFileShare`).
- New tool layer `public` → `public-data-files` (PUBLIC): features of shared files in the view (at most 500), drawn through the GeoJSON surface, offered to the Data Panel, filtered by keyword/tag in `PublicDataFilesSettings` (text group `publicDataFiles`). Drop it with `dataFilesTool({shared:false})`.
- Contracts: `core/data-file-share.ts` (share fields, feature collection limits, public query/response) and `core/share-tags.ts` (tag rules and `automaticShareTag`, shared with photos); `viewportBbox` in `core/public-photo-query.ts`. The service keeps byte-identical copies.
- `PublicClient` paths `dataFiles` and `dataFileShares`; `notify`/`subscribe` accept `"dataFiles"`.

## 1.2.0

Data Panel: an attribute table and summary chart for any layer, without breaking 1.x.

- `DataSource` (package root) and `useDataSource(source)`/`useDataSources()` in `/react`: tools and hosts offer rows (GeoJSON features) tied to a registry layer; sources follow the layer's visibility and order.
- `DataPanel` in `/react`: one tab per source, search, paging, row → map (`onSelect` to override), and a chart view (histogram for numeric columns, top categories otherwise). Text group `dataPanel`.
- Data Files offers its rows (CSV columns included) as a source for its layer.
- `WorkspacePanels data` slot below the map; both examples show the Data Panel.
- Core helpers `tableColumns`, `numericValue`, `columnKind`, `matchesQuery`, `summarizeColumn`.

## 1.1.0

Per-tool entry points, without breaking 1.0 imports.

- `@thaiwater/toolbox-sdk/tools/photo`, `/tools/draw`, `/tools/data-files`, `/tools/navigation`: each exports the tool's plugin factory, UI components, store factory and Thai text defaults.
- Tools read text through `useToolText(group, defaults)` and storage through `useToolStorage(kind, create)`, so a tool entry no longer loads every tool's text or stores. `useToolMessages()`/`thMessages` keep working.
- `ToolboxRuntime.storage` is optional and may be partial; missing stores default to `storageName(appId, tool)`.
- `storageName` and `formatExpiry` in `/storage`; `formatPhotoExpiry` is deprecated.
- `tests/tool-boundaries.test.ts` fails if a tool entry imports another tool or an aggregate.

## 1.0.0

Tool API 2.0 becomes the only toolbox contract. Storage schema v1 and the service HTTP contract are unchanged, so saved browser data and existing gateways keep working.

### Breaking

- Removed Host API 1.0: `WebmapHost`, `ToolboxDefinition`, `ToolboxHost`, `toolboxAvailable`, `defineToolboxes`, `WEBMAP_API_VERSION`, the 1.0 `NavigationTool` component and `WorkspaceToolServices`/`PhotoServices`/`DrawingServices`/`DataFileServices`.
- Removed `LayerDefinition.photoDataKey`, `drawingDataKey` and `toolboxId`; tool layers are identified by `owner` (`isToolLayer(layer)` is `!!layer.owner`).
- `DrawingWorkspace` takes `mine`/`shared` layers instead of a `layers` list.
- `photoTool` moved from `/maplibre` to `/react` and is engine-neutral; `PhotoLayers` (react-map-gl markers) was removed.
- Removed the `./*` wildcard export. Public entry points are the package root, `/react`, `/maplibre`, `/storage`, `/core/drawing`, `/core/data-files`, `/core/photo-gps` and `/styles.css`.
- `ToolboxProvider messages` is grouped by component (`ToolboxMessagesOverride`).

### Added

- `PhotoOverlay`: photo markers and popup as HTML positioned through `MapAdapter.project`.
- All UI text in `thMessages`, overridable per group; `useToolMessages()` also works outside a provider.
- Colour tokens (`--sdk-*`) with the previous colours as fallbacks.
- `examples/leaflet`: the same four tools on Leaflet through a ~100-line adapter.

### Migrating from 0.4

1. Replace `ToolboxHost`/`WebmapHost` wiring with `ToolboxProvider plugins` + `ToolboxPanel`/`ToolOverlays`/`ToolDialogs`.
2. Import `photoTool` from `@thaiwater/toolbox-sdk/react`.
3. Replace checks on `photoDataKey`/`drawingDataKey`/`toolboxId` with `layer.owner?.toolId` / `layer.owner?.key`.
4. Replace deep imports (`@thaiwater/toolbox-sdk/ui/...`, `/adapters/...`, `/core/<file>`) with the entry points above.
5. Move custom text overrides into their component group, e.g. `{dataFilesTool:{title:'…'}}`.

## 0.4.0

Built-in plugins (`dataFilesTool`, `drawTool`, `photoTool`, `navigationTool`), plugin `Controller` and `layerSettings`, workspace-wide dialogs, MapLibre GeoJSON surface reorder fix.

## 0.3.0

Tool API 2.0 runtime: `ToolboxProvider plugins`, `ToolboxPanel`, `ToolOverlays`, `ToolDialogs`, tool hooks.

## 0.2.0

Tool API 2.0 contracts: layer owners, owned registration, optional `MapAdapter` pointer/overlay/GeoJSON members, `ToolPlugin`.
