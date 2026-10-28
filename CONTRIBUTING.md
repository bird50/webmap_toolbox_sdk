# Working on the Toolbox as a team

The SDK, `toolbox_service` and the web are split by tool so that two or three developers can each own a tool (for
example A: Draw, B: Data Files/KML upload) and work in parallel without editing the same files.

## Who owns what

| Owner | SDK (`toolbox_sdk`) | Service (`toolbox_service`) | Web (`simple_gis_webapp`) |
| --- | --- | --- | --- |
| Tool owner (one per tool) | `src/tools/<tool>/`, its contracts in `src/contracts/`, `tests/tools/<tool>*` | `src/modules/<module>.ts`, its tests | `app/api/**/<tool>*` routes, `lib/toolbox/queries/<tool>.ts` |
| Maintainer | `src/ui`, `src/core`, `src/storage`, `src/adapters`, shared contracts (`share-tags`, `public-photo-query`), `package.json`, releases | `src/service.ts`, `src/modules/context.ts`, keys, auth, database, server | toolbox wiring (`config/`, `components/map/`, `lib/toolbox/service.ts`), releases |

`.github/CODEOWNERS` in each repository records this; replace the placeholder owners with the developers' GitHub names
and turn on "Require review from Code Owners" for `main` in the repository settings.

Tool folders by tool:

| Tool | SDK | Contracts (`src/contracts/`) | Service module |
| --- | --- | --- | --- |
| Photo | `src/tools/photo/` | `photo-share`, `photo-gps`, `public-photo-sets` | `photos` |
| Draw | `src/tools/draw/` | `drawing-contract`, `public-drawing-sets` | `drawings` |
| Data Files (KML/GeoJSON/CSV) | `src/tools/data-files/` | `data-file-share`, `public-data-file-sets` | `data-files` |
| Navigation | `src/tools/navigation/` | — | — |

## Day to day

1. Branch from `main` named after the tool: `draw/arrow-styles`, `data-files/kmz`, `shared/owned-layer-order`.
2. Stay inside your tool's folders. `tests/tool-boundaries.test.ts` fails if a tool imports another tool's files.
3. Add a change fragment `changes/<tool>-<slug>.md` instead of editing `CHANGELOG.md` or the version (`changes/README.md`).
4. Open a pull request. CI must pass (lint, tests, build, examples); the tool's owner (and the maintainer for shared files)
   reviews it.

### Changes that cross a boundary

- **Shared runtime** (a new hook, a registry change, a shared contract): open an issue, let the maintainer land it in its
  own pull request, then use it from the tool. Never mix a shared change into a tool's pull request.
- **A service contract** (`src/contracts/*`): change it in the SDK first. After it is merged, run
  `npm run contracts:sync` in `toolbox_service`, implement the route in the tool's module and open the service pull
  request; its CI (`npm run contracts:check`) compares the copies with the SDK's `main`.
- **Service schema**: append a migration to your module's `migrations` list; never edit or reorder existing ones.
- **Web**: add or change routes for your tool only; wiring (`config/toolboxes.tsx`, `GISMap.tsx`) goes through the
  maintainer.

## Local setup per developer

- Keep the three repositories side by side (`bird_dev/toolbox_sdk`, `bird_dev/toolbox_service`,
  `bird_dev/simple_gis_webapp`).
- Service: your own `SQLITE_PATH` and key; serve only what you work on, e.g. `TOOLBOX_MODULES=drawings npm run dev`.
- SDK: `npx tsx --test tests/tools/draw.test.ts` runs just your tool's tests (`npm test` runs all);
  `examples/` show the tools on two map engines.
- Web: after an SDK change reinstall it (`rm -rf node_modules/@thaiwater/toolbox-sdk && npm install ../toolbox_sdk --install-links`, then restart dev; delete `.next/dev` if SDK styles disappear).

## Release (maintainer)

1. SDK: `npm run release` collects `changes/*.md` into `CHANGELOG.md` and bumps the version; build, commit, push.
2. Service: `npm run contracts:sync`, `npm run contracts:check`, tests, bump its version and README.
3. Web: reinstall the SDK, lint, build, tests, go through `docs/toolbox-regression-checklist.md` and add a result row.
