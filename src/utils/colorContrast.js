import { getContrastRatio } from "@mui/material/styles";

export const WCAG_AA_TEXT_CONTRAST = 4.5;
export const WCAG_UI_CONTRAST = 3;

const DEFAULT_DARK_TEXT = "#0B1220";
const DEFAULT_LIGHT_TEXT = "#FFFFFF";

export function getSafeContrastRatio(foregroundColor, backgroundColor) {
  try {
    return getContrastRatio(foregroundColor, backgroundColor);
  } catch {
    return 0;
  }
}

export function getReadableTextColor(
  backgroundColor,
  {
    darkText = DEFAULT_DARK_TEXT,
    lightText = DEFAULT_LIGHT_TEXT,
    minContrast = WCAG_AA_TEXT_CONTRAST,
    candidates = [],
  } = {}
) {
  const testedCandidates = [darkText, lightText, ...candidates].filter(Boolean);
  const rankedCandidates = testedCandidates
    .map((color) => ({
      color,
      contrastRatio: getSafeContrastRatio(color, backgroundColor),
    }))
    .sort((left, right) => right.contrastRatio - left.contrastRatio);

  return (
    rankedCandidates.find((candidate) => candidate.contrastRatio >= minContrast) ||
    rankedCandidates[0] || { color: darkText }
  ).color;
}
