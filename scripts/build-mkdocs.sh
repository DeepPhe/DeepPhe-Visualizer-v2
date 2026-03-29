#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/output/playwright"
DOCS_SCREENSHOT_DIR="$ROOT_DIR/docs/assets/screenshots"
SUMMARY_PATH="$OUTPUT_DIR/capture-summary.json"
FULL_REPORT_PATH="$ROOT_DIR/docs/full-report.md"
VENV_DIR="$ROOT_DIR/.venv-mkdocs"

required_files=(
  "01-home.png"
  "02-filters-overview.png"
  "03-identified-patients-panel.png"
  "04-theme-selector-open.png"
  "05-theme-obsidian.png"
  "06-theme-solstice.png"
  "07-theme-vapor.png"
  "08-filterset-demographics.png"
  "09-filter-age-at-dx.png"
  "10-filter-race.png"
  "11-filter-gender.png"
  "12-filter-ethnicity.png"
  "13-filterset-cancer-type.png"
  "14-filter-cancer.png"
  "15-filterset-staging.png"
  "16-filter-stage.png"
  "17-filter-t-stage.png"
  "18-filter-n-stage.png"
  "19-filter-m-stage.png"
  "20-filter-lymph-involvement.png"
  "21-filter-selection-active-state.png"
  "22-patient-details-overview.png"
  "23-patient-details-column-menu.png"
  "24-patient-details-expanded-row.png"
  "25-patient-details-empty-search.png"
  "26-horizontal-bar-chart-demo.png"
  "27-filter-bar-chart-demo.png"
  "28-filter-list-control-demo.png"
  "29-patient-grid-demo.png"
  "30-debug-view.png"
  "31-accessibility-view.png"
)

mkdir -p "$DOCS_SCREENSHOT_DIR" "$ROOT_DIR/output/reports"

missing=0
for file in "${required_files[@]}"; do
  if [[ ! -f "$OUTPUT_DIR/$file" ]]; then
    echo "Missing screenshot: $OUTPUT_DIR/$file" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Screenshot set is incomplete. Run scripts/capture-screenshots.mjs first." >&2
  exit 1
fi

for file in "${required_files[@]}"; do
  cp "$OUTPUT_DIR/$file" "$DOCS_SCREENSHOT_DIR/$file"
done

cd "$ROOT_DIR"

node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const summaryPath = path.join(process.cwd(), "output", "playwright", "capture-summary.json");
const reportPath = path.join(process.cwd(), "docs", "full-report.md");
const startMarker = "<!-- CAPTURE_NOTES_START -->";
const endMarker = "<!-- CAPTURE_NOTES_END -->";

if (!fs.existsSync(reportPath)) {
  process.exit(0);
}

let replacement = "- Capture summary is unavailable for this run.";

if (fs.existsSync(summaryPath)) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const missing = Array.isArray(summary.missingStates) ? summary.missingStates : [];
  const runtimeNotes = Array.isArray(summary.runtimeNotes) ? summary.runtimeNotes : [];

  if (missing.length === 0) {
    replacement = "- All required UI states were captured successfully in this run.";
  } else {
    replacement = [
      "- Some data-driven states were unavailable in this run:",
      ...missing.map((item) => `  - \`${item.file}\`: ${item.note || "Unavailable at runtime."}`),
      "- Fallback screenshots from available routes are included in this report.",
    ].join("\n");
  }

  if (runtimeNotes.length > 0) {
    replacement += "\n" + runtimeNotes.map((note) => `- ${note}`).join("\n");
  }
}

const content = fs.readFileSync(reportPath, "utf8");
const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, "m");
const next = content.replace(pattern, `${startMarker}\n${replacement}\n${endMarker}`);
fs.writeFileSync(reportPath, next);
NODE

if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
python -m pip install --upgrade pip >/dev/null
python -m pip install --upgrade mkdocs mkdocs-material >/dev/null

mkdocs build --clean --config-file "$ROOT_DIR/mkdocs.yml"

echo "MKDocs build complete: $ROOT_DIR/site"
