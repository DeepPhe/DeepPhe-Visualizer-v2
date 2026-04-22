#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_SOURCE_DIR = "/Volumes/Samsung-Ext/dev/Viz2/public/docs";
const SOURCE_DIR = path.resolve(process.env.VIZ2_DOCS_SOURCE_DIR || DEFAULT_SOURCE_DIR);
const TARGET_DIR = path.resolve(process.cwd(), "public/docs/viz2");
const MANIFEST_PATH = path.join(TARGET_DIR, "index.json");

function formatLabel(patientId) {
  const normalizedPatientId = String(patientId || "").trim();
  const fakePatientMatch = normalizedPatientId.match(/^fake_patient(\d+)$/i);

  if (fakePatientMatch) {
    return `Fake_patient_${fakePatientMatch[1]}`;
  }

  return normalizedPatientId;
}

function isPatientPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const hasId =
    typeof payload.id === "string" && payload.id.trim().length > 0
      ? payload.id.trim()
      : typeof payload.patientId === "string" && payload.patientId.trim().length > 0
        ? payload.patientId.trim()
        : "";

  return Boolean(hasId && Array.isArray(payload.documents));
}

function ensureTargetDir() {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function clearTargetJsonFiles() {
  if (!fs.existsSync(TARGET_DIR)) {
    return;
  }

  for (const fileName of fs.readdirSync(TARGET_DIR)) {
    if (!fileName.toLowerCase().endsWith(".json")) {
      continue;
    }

    fs.unlinkSync(path.join(TARGET_DIR, fileName));
  }
}

function writeManifest(options) {
  const sortedOptions = [...options].sort((left, right) =>
    left.label.localeCompare(right.label, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(sortedOptions, null, 2)}\n`, "utf8");
}

function main() {
  ensureTargetDir();
  clearTargetJsonFiles();

  if (!fs.existsSync(SOURCE_DIR) || !fs.statSync(SOURCE_DIR).isDirectory()) {
    writeManifest([]);
    console.warn(`[sync-viz2-docs] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const options = [];
  const seenIds = new Set();
  const sourceJsonFiles = fs
    .readdirSync(SOURCE_DIR)
    .filter((fileName) => fileName.toLowerCase().endsWith(".json"));

  for (const fileName of sourceJsonFiles) {
    const sourcePath = path.join(SOURCE_DIR, fileName);

    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    } catch {
      continue;
    }

    if (!isPatientPayload(payload)) {
      continue;
    }

    const patientId = String(payload.id || payload.patientId || "").trim();
    if (!patientId || seenIds.has(patientId)) {
      continue;
    }

    const targetFileName = `${patientId}.json`;
    const targetPath = path.join(TARGET_DIR, targetFileName);

    fs.copyFileSync(sourcePath, targetPath);
    seenIds.add(patientId);
    options.push({ id: patientId, label: formatLabel(patientId) });
  }

  writeManifest(options);
  console.log(
    `[sync-viz2-docs] Synced ${options.length} patient file(s) from ${SOURCE_DIR} to ${TARGET_DIR}`
  );
}

main();
