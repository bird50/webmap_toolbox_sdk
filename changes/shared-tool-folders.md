bump: minor
- Source layout for parallel work: each tool lives in its own folder `src/tools/<tool>/` (plugin, UI, storage, parsers, text), and the contracts shared with Toolbox Service live in `src/contracts/`. Public entries are unchanged (`/tools/*`, `/core/drawing`, `/core/data-files`, `/core/photo-gps`, `/react/core`, `/react`); only `dist/` paths behind them moved.
- DOM tests are split per tool (`tests/tools/<tool>.test.ts`, shared setup in `tests/helpers/dom.ts`); cross-tool cases stay in `tests/plugins-dom.test.ts`.
- `CHANGELOG.md` and the version are written at release time from fragments in `changes/` (`npm run release`).
- **Breaking for Tailwind hosts:** tool components moved to `src/tools`, so add `@source "<path to the package>/src/tools";` next to the existing `src/ui` and `src/adapters` sources (hosts using `styles.css` need nothing).
