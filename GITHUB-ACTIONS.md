# GitHub Actions

This repository has two workflows in [`.github/workflows/`](.github/workflows/):

| Workflow | File | Triggers |
|----------|------|----------|
| **CI** | [`ci.yml`](.github/workflows/ci.yml) | push & pull requests to `main` / `develop` |
| **Release** | [`release.yml`](.github/workflows/release.yml) | push of a `v*` tag, or manual run |

## What happens on push

| You do this | What runs |
|-------------|-----------|
| Push commits to `main` or `develop` | **CI** (lint, tests, app build, docs build) |
| Open or update a pull request targeting `main` / `develop` | **CI** |
| Push a tag like `v0.1.0` | **Release** (builds the four binaries and publishes a GitHub Release) |
| Run **Release** manually from the Actions tab | Builds the four binaries and uploads them as run artifacts (no Release is created without a tag) |

Pushing to any other branch, or pushing a tag that doesn't start with `v`, runs nothing.

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

Triggered by pushing a tag that starts with `v` (e.g. `v0.1.0`), or manually via
**workflow_dispatch**. It has `contents: write` permission so it can create the
Release and upload assets.

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

Each job:
1. Checkout, set up Node `24.x` (with npm cache).
2. `npm ci --legacy-peer-deps`.
3. `npm run package:web` — builds the SPA with a same-origin API base
   (`REACT_APP_DEEPPHE_API_LOCATION=/`) so the binary's reverse proxy works.
4. `node scripts/package-pkg.mjs <target>` — packages that one native target
   into `dist/`.
5. Uploads the binary as a run artifact (`actions/upload-artifact`).
6. **Only on a tag**: attaches the binary to the GitHub Release for that tag
   (`softprops/action-gh-release`, which creates the Release if needed).

### Cutting a release

```bash
git tag v0.1.0
git push origin v0.1.0
```

When all four jobs finish, the Release for `v0.1.0` contains the four binaries.
See [README.md](README.md#standalone-executable) for how to run them.

### Manual builds without a release

From the **Actions** tab, choose **Release** → **Run workflow**. The binaries are
produced and uploaded as run artifacts (downloadable from the run summary), but
no GitHub Release is created because the run isn't on a tag.
