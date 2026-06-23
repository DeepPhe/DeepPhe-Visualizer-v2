# GitHub Actions

This repository has two workflows in [`.github/workflows/`](.github/workflows/):

| Workflow | File | Triggers |
|----------|------|----------|
| **CI** | [`ci.yml`](.github/workflows/ci.yml) | push & pull requests to `main` / `develop` |
| **Release** | [`release.yml`](.github/workflows/release.yml) | push to `main` |

## What happens on push

| You do this | What runs |
|-------------|-----------|
| Push commits to `main` | **CI** plus **Release** (builds the four binaries and updates the rolling `deepphe-visualizer-v2-main-latest` prerelease in `DeepPhe/DeepPhe-Dist`) |
| Push commits to `develop` | **CI** (lint, tests, app build, docs build) |
| Open or update a pull request targeting `main` / `develop` | **CI** |

Pushing to any branch other than `main` or `develop`, or pushing tags, runs no
release publishing workflow.

## CI — `ci.yml`

Runs on every push and pull request to `main` and `develop`. Two jobs run in parallel:

### `build`
Runs on `ubuntu-latest` against a Node matrix (`18.x`, `20.x`). Steps:
1. Checkout, set up Node (with npm cache).
2. `npm ci --legacy-peer-deps`.
3. `npm run lint` — ESLint.
4. `npm run lint:patient-ids` — fails if hardcoded patient-like identifiers are found.
5. `npm run lint:a11y` — accessibility-focused ESLint rules.
6. `npm test -- --coverage --watchAll=false` — Jest / React Testing Library.
7. `npm run build` (with `CI=true`, so warnings fail the build).
8. Reports the build size.

A failure in any step marks the commit/PR check as failed.

### `documentation`
Runs on `ubuntu-latest` with Node `20.x`. Builds the Docusaurus user guide:
1. Checkout, set up Node (cache keyed on `docs-site/package-lock.json`).
2. `npm ci --prefix docs-site`.
3. `npm --prefix docs-site run typecheck`.
4. `npm run docs:build` — generates the static guide into `site/`.
5. Uploads `site/` as the `deepphe-visualizer-user-guide` artifact.

## Release — `release.yml`

Triggered only by pushing commits to `main`.

The workflow publishes release assets to
[`DeepPhe/DeepPhe-Dist`](https://github.com/DeepPhe/DeepPhe-Dist/releases), not
to this repository. Configure a repository secret named
`DEEPPHE_DIST_RELEASE_TOKEN` before using it. The token must have
`contents:write` access to `DeepPhe/DeepPhe-Dist`; this repository's default
`GITHUB_TOKEN` cannot upload assets to another repository.

A `package` job runs as a matrix with `fail-fast: false` (one target failing
does not cancel the others). Each target is built on a runner whose OS/arch
matches it, so [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) never has to
cross-fabricate (cross-arch fabrication fails — e.g. macOS arm64 cannot be built
on an x64 host):

| Target | Runner | Output asset |
|--------|--------|--------------|
| `node24-macos-arm64` | `macos-14` (Apple Silicon) | `deepphe-visualizer-v2-macos-arm64` |
| `node24-macos-x64` | `macos-13` (Intel) | `deepphe-visualizer-v2-macos-x64` |
| `node24-linux-x64` | `ubuntu-latest` | `deepphe-visualizer-v2-linux-x64` |
| `node24-win-x64` | `windows-latest` | `deepphe-visualizer-v2-win-x64.exe` |

Each package job:
1. Checkout, set up Node `24.x` (with npm cache).
2. `npm ci --legacy-peer-deps`.
3. `npm run package:web` — builds the SPA with a same-origin API base
   (`REACT_APP_DEEPPHE_API_LOCATION=/`) so the binary's reverse proxy works.
4. `node scripts/package-pkg.mjs <target>` — packages that one native target
   into `dist/`.
5. Uploads the binary as a run artifact (`actions/upload-artifact`).

After all package jobs finish, the `publish` job downloads the four artifacts
and uploads them to `DeepPhe/DeepPhe-Dist` with `gh release upload --clobber`.
Every successful run creates or updates the
`deepphe-visualizer-v2-main-latest` prerelease in `DeepPhe/DeepPhe-Dist`, then
overwrites the four binary assets there. See
[README.md](README.md#standalone-executable) for how to run them.
