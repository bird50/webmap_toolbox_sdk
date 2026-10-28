# Change fragments

Each pull request adds one file here instead of editing `CHANGELOG.md` or the package version, so developers working on
different tools never conflict on those files.

- Name: `<area>-<short-slug>.md`, where `<area>` is the tool folder (`photo`, `draw`, `data-files`, `navigation`) or
  `shared` (runtime, adapters, contracts, storage helpers).
- Content: Markdown bullets for users of the SDK (what changed, how to migrate). Mark breaking changes with
  `**Breaking:**`.
- The first line may be `bump: major|minor|patch` (default `patch`); the release takes the largest bump.

The maintainer releases with `npm run release` (or `npm run release -- 1.12.0` for an exact version): it moves every
fragment into a new `CHANGELOG.md` section, grouped by area, deletes the fragments and sets the version in
`package.json` and `package-lock.json`.
