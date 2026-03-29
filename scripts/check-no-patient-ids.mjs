#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".css",
  ".scss",
  ".html",
  ".txt",
]);
const SKIP_PREFIXES = ["node_modules/", "build/", "dist/", "site/", "output/"];
const SKIP_EXACT = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);

function getTrackedFiles() {
  const output = execSync("git ls-files -co --exclude-standard", {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((filePath) => !SKIP_EXACT.has(filePath))
    .filter((filePath) => !SKIP_PREFIXES.some((prefix) => filePath.startsWith(prefix)))
    .filter((filePath) => TEXT_EXTENSIONS.has(path.extname(filePath)));
}

function addFinding(findings, filePath, lineNumber, reason, matchText) {
  findings.push({
    filePath,
    lineNumber,
    reason,
    matchText: String(matchText || "").slice(0, 120),
  });
}

function scanFile(filePath, findings) {
  const absolutePath = path.join(ROOT_DIR, filePath);
  if (!fs.existsSync(absolutePath)) {
    return;
  }
  const content = fs.readFileSync(absolutePath, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 1;
    const patientIdShapeMatches = line.matchAll(/\b955\d{7}\b/g);
    for (const match of patientIdShapeMatches) {
      addFinding(
        findings,
        filePath,
        lineNumber,
        "patient-like identifier pattern (955########)",
        match[0]
      );
    }

    const patientLiteralMatches = line.matchAll(
      /\b(patient_id|patientId)\b\s*[:=]\s*["'`]([^"'`]+)["'`]/g
    );
    for (const match of patientLiteralMatches) {
      const candidateValue = String(match[2] || "");
      if (/\d{4,}/.test(candidateValue)) {
        addFinding(
          findings,
          filePath,
          lineNumber,
          "patient id literal contains digits",
          match[0]
        );
      }
    }
  });
}

function main() {
  const findings = [];
  const files = getTrackedFiles();

  files.forEach((filePath) => {
    scanFile(filePath, findings);
  });

  if (findings.length === 0) {
    console.log("No hardcoded patient-like identifiers detected.");
    process.exit(0);
  }

  console.error("\nHardcoded patient-like identifiers detected:\n");
  findings.slice(0, 200).forEach((finding) => {
    console.error(
      `- ${finding.filePath}:${finding.lineNumber} (${finding.reason}) -> ${finding.matchText}`
    );
  });

  if (findings.length > 200) {
    console.error(`\n...and ${findings.length - 200} more findings.`);
  }

  console.error(
    "\nRemove/redact these values or replace them with non-identifying placeholders."
  );
  process.exit(1);
}

main();
