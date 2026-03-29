#!/usr/bin/env node

/**
 * zip-for-review.mjs
 *
 * Zips project source code for code review.
 * Excludes ALL data (HIPAA or otherwise), build artifacts,
 * coverage, dependencies, images, and anything that isn't code/config.
 *
 * Uses `find -prune` to build an explicit file list, then `zip -@`
 * so there are no glob-pattern surprises (looking at you, node_modules).
 *
 * Usage:  node zip-for-review.mjs [projectDir] [outputFile]
 *
 * Defaults:
 *   projectDir  = current working directory
 *   outputFile  = deepphe-code-review.zip (in cwd)
 */

import { execSync } from "node:child_process";
import { existsSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, basename, extname } from "node:path";

const projectDir = resolve(process.argv[2] || ".");
const outputFile = resolve(process.argv[3] || "deepphe-code-review.zip");
const tmpFileList = resolve(projectDir, ".zip-filelist.tmp");

// ── Directories to prune (find will never descend into these) ──────
const PRUNE_DIRS = [
  "node_modules",
  ".git",
  "coverage",
  "dist",
  "build",
  ".cache",
  ".parcel-cache",
  ".idea",
  ".vscode",
  "__pycache__",
];

// ── File extensions to EXCLUDE ─────────────────────────────────────
const EXCLUDE_EXTS = new Set([
  // Data — no patient/clinical data whatsoever
  ".csv", ".tsv", ".xlsx", ".xls", ".parquet",
  ".db", ".sqlite", ".sql", ".ndjson", ".jsonl",
  // Images / binary (screenshots could contain PHI)
  ".png", ".jpg", ".jpeg", ".gif", ".bmp",
  ".tiff", ".ico", ".svg", ".pdf", ".webp",
  // Archives
  ".zip", ".tar", ".gz", ".tgz", ".bz2",
  // Logs
  ".log",
  // Editor swap
  ".swp", ".swo",
]);

// ── Exact filenames to EXCLUDE ─────────────────────────────────────
const EXCLUDE_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".DS_Store",
  "Thumbs.db",
  ".env",
  "tree.txt",
  "zip-for-review.mjs",
  basename(outputFile),
  basename(tmpFileList),
]);

// ── JSON files that ARE safe (config only, not data) ───────────────
const JSON_WHITELIST = new Set([
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  ".eslintrc.json",
  ".prettierrc.json",
  "babel.config.json",
]);

// ── Preflight checks ──────────────────────────────────────────────
try {
  execSync("which zip", { stdio: "ignore" });
} catch {
  console.error("Error: 'zip' not found. Install it first (apt install zip / brew install zip).");
  process.exit(1);
}

if (!existsSync(projectDir)) {
  console.error(`Error: project directory not found: ${projectDir}`);
  process.exit(1);
}

// ── Use find with -prune to get candidate files ────────────────────
const pruneExpr = PRUNE_DIRS.map((d) => `-name '${d}'`).join(" -o ");
const findCmd = `cd "${projectDir}" && find . \\( ${pruneExpr} \\) -prune -o -type f -print`;

console.log("Scanning project files...\n");

const allFiles = execSync(findCmd, { shell: "/bin/bash", encoding: "utf-8" })
  .trim()
  .split("\n")
  .filter(Boolean);

// ── Filter to code/config only ─────────────────────────────────────
const included = [];
const excluded = [];

for (const f of allFiles) {
  const name = basename(f);
  const ext = extname(f).toLowerCase();

  if (EXCLUDE_NAMES.has(name)) {
    excluded.push(f);
    continue;
  }

  // .env.local, .env.production, etc.
  if (name.startsWith(".env.") || name.startsWith(".env-")) {
    excluded.push(f);
    continue;
  }

  if (EXCLUDE_EXTS.has(ext)) {
    excluded.push(f);
    continue;
  }

  // .json: whitelist only known config files
  if (ext === ".json") {
    if (JSON_WHITELIST.has(name)) {
      included.push(f);
    } else {
      excluded.push(f);
    }
    continue;
  }

  included.push(f);
}

if (included.length === 0) {
  console.error("No files matched. Is this the right project directory?");
  process.exit(1);
}

// ── Create the zip ─────────────────────────────────────────────────
writeFileSync(tmpFileList, included.join("\n") + "\n");

if (existsSync(outputFile)) {
  unlinkSync(outputFile);
}

console.log(`Zipping ${included.length} files...\n`);

execSync(`cd "${projectDir}" && zip "${outputFile}" -@ < "${tmpFileList}"`, {
  stdio: "inherit",
  shell: "/bin/bash",
});

unlinkSync(tmpFileList);

// ── Report ─────────────────────────────────────────────────────────
const stats = statSync(outputFile);
const sizeKB = (stats.size / 1024).toFixed(0);

console.log(`\n${"═".repeat(60)}`);
console.log(`✅  ${outputFile}`);
console.log(`    ${sizeKB} KB · ${included.length} files included · ${excluded.length} excluded`);

console.log(`\n📋  INCLUDED:`);
for (const f of included) console.log(`    ${f}`);

console.log(`\n🚫  EXCLUDED:`);
for (const f of excluded) console.log(`    ${f}`);

console.log(`\n⚠️   BEFORE SHARING — spot-check the contents:`);
console.log(`    unzip -l "${outputFile}"`);
console.log(`    Confirm ZERO patient data, PHI, or HIPAA-covered info.`);
console.log(`${"═".repeat(60)}\n`);
