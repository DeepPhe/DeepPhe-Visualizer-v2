import { getContrastRatio } from "@mui/material/styles";
import { THEME_OPTIONS, getThemeByKey } from "../../themes";
import {
  WCAG_AA_TEXT_CONTRAST,
  getReadableTextColor,
  getSafeContrastRatio,
} from "../colorContrast";
import {
  DEFAULT_GROUP_COLOR,
  GROUP_COLOR_BY_NAME,
} from "../patientView/documentMentions";

const EFFECTIVE_THEME_BACKGROUNDS = {
  obsidian: ["#0F1419", "#1A2332"],
  vapor: ["#0C0A1D", "#161425"],
  govuk: ["#F3F2F1", "#FFFFFF"],
};

describe("WCAG color contrast", () => {
  it("keeps core bright and dark theme text colors at AA contrast", () => {
    THEME_OPTIONS.forEach(({ key }) => {
      const theme = getThemeByKey(key);
      const backgrounds = EFFECTIVE_THEME_BACKGROUNDS[key];
      const foregrounds = [
        theme.palette.text.primary,
        theme.palette.text.secondary,
        theme.palette.text.disabled,
        theme.palette.primary.main,
      ].filter(Boolean);

      backgrounds.forEach((backgroundColor) => {
        foregrounds.forEach((foregroundColor) => {
          expect(getContrastRatio(foregroundColor, backgroundColor)).toBeGreaterThanOrEqual(
            WCAG_AA_TEXT_CONTRAST
          );
        });
      });

      expect(getContrastRatio(theme.palette.primary.contrastText, theme.palette.primary.main)).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT_CONTRAST
      );

      [[theme.custom?.chipActiveText, theme.custom?.chipActiveBg]]
        .filter(([foregroundColor, backgroundColor]) => foregroundColor && backgroundColor)
        .forEach(([foregroundColor, backgroundColor]) => {
          expect(getContrastRatio(foregroundColor, backgroundColor)).toBeGreaterThanOrEqual(
            WCAG_AA_TEXT_CONTRAST
          );
        });
    });
  });

  it("selects readable foregrounds for all document concept colors", () => {
    [DEFAULT_GROUP_COLOR, ...Object.values(GROUP_COLOR_BY_NAME)].forEach((backgroundColor) => {
      const foregroundColor = getReadableTextColor(backgroundColor);

      expect(getSafeContrastRatio(foregroundColor, backgroundColor)).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT_CONTRAST
      );
    });
  });
});
