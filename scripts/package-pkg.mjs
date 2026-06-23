#!/usr/bin/env node
/**
 * Builds self-contained executables of the DeepPhe Visualizer v2 production
 * server (serve.js) with @yao-pkg/pkg.
 *
 * Why a staging directory instead of running `pkg .` at the repo root:
 * pkg force-includes everything listed under package.json "dependencies". This
 * repo's dependencies are the React/MUI frontend tree, which is ALREADY
 * compiled into build/ and is not needed at runtime by the Node server. Running
 * pkg against the root manifest therefore bundles the entire frontend into the
 * binary (hundreds of MB, very slow, and it breaks multi-target builds).
 *
 * Instead we assemble a throwaway staging dir whose manifest declares only the
 * two real server dependencies (express, http-proxy-middleware), reuse the
 * repo's installed node_modules, and package from there. The result bundles
 * just serve.js + src/piper-server + build/ + those two deps.
 *
 * Prerequisites:
 *   - `npm install` has been run (node_modules present).
 *   - `npm run package:web` has produced build/ (relative API base for the proxy).
 *   - Node >= 20 (required by @yao-pkg/pkg's toolchain).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagingDir = path.join(repoRoot, ".pkg-build");
const distDir = path.join(repoRoot, "dist");
const buildIndex = path.join(repoRoot, "build", "index.html");

const TARGETS = [
  "node24-macos-arm64",
  "node24-macos-x64",
  "node24-linux-x64",
  "node24-win-x64",
];

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) {
  console.error(
    `This script requires Node >= 20 to run @yao-pkg/pkg (found v${process.versions.node}).`
  );
  process.exit(1);
}

if (!fs.existsSync(buildIndex)) {
  console.error("build/index.html not found — run `npm run package:web` first.");
  process.exit(1);
}

// Fresh staging directory.
fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// Server sources (small — copy so pkg snapshots real files).
fs.copyFileSync(path.join(repoRoot, "serve.js"), path.join(stagingDir, "serve.js"));
fs.cpSync(
  path.join(repoRoot, "src", "piper-server"),
  path.join(stagingDir, "src", "piper-server"),
  { recursive: true }
);

// Reuse the repo's installed dependencies and the built frontend via symlinks
// (no second npm install, no 12 MB copy). pkg only embeds what the manifest
// declares + what serve.js requires, so the rest of node_modules is ignored.
fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(stagingDir, "node_modules"));
fs.symlinkSync(path.join(repoRoot, "build"), path.join(stagingDir, "build"));

// Minimal manifest: only the real server deps, so nothing extra is bundled.
// Targets are passed per-invocation below (not via pkg.targets) because a
// single multi-target run emits only the first binary in this toolchain.
const repoPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8"));
const manifest = {
  name: repoPkg.name,
  version: repoPkg.version,
  private: true,
  bin: "serve.js",
  pkg: { assets: ["build/**/*"] },
  dependencies: {
    express: repoPkg.dependencies.express,
    "http-proxy-middleware": repoPkg.dependencies["http-proxy-middleware"],
  },
};
fs.writeFileSync(
  path.join(stagingDir, "package.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const pkgBin = path.join(repoRoot, "node_modules", ".bin", "pkg");
const outputName = (target) => {
  // node24-macos-arm64 -> deepphe-visualizer-v2-macos-arm64(.exe)
  const suffix = target.replace(/^node\d+-/, "");
  return `${manifest.name}-${suffix}${suffix.startsWith("win-") ? ".exe" : ""}`;
};

// Build each target independently so one unbuildable target (e.g. macos-arm64
// requires an Apple Silicon host) doesn't abort the rest.
const succeeded = [];
const failed = [];
for (const target of TARGETS) {
  const outPath = path.join(distDir, outputName(target));
  console.log(`\n=== Packaging ${target} -> ${path.basename(outPath)} ===`);
  const result = spawnSync(pkgBin, [".", "-t", target, "-o", outPath], {
    cwd: stagingDir,
    stdio: "inherit",
  });
  if (result.status === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    if (!outPath.endsWith(".exe")) {
      fs.chmodSync(outPath, 0o755);
    }
    succeeded.push(path.basename(outPath));
  } else {
    failed.push(target);
    fs.rmSync(outPath, { force: true }); // drop empty/partial output
  }
}

console.log(`\nBinaries written to ${distDir}`);
for (const name of succeeded) {
  console.log("  ✓", name);
}
if (failed.length > 0) {
  console.log("\nSkipped/failed targets:");
  for (const target of failed) {
    const note =
      target === "node24-macos-arm64" && process.arch !== "arm64"
        ? " (macOS arm64 must be built on an Apple Silicon host)"
        : "";
    console.log("  ✗", target + note);
  }
}
if (succeeded.length === 0) {
  process.exit(1);
}
