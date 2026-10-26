# Changelog

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
