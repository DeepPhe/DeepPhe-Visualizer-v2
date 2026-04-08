import React, { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Container,
  CssBaseline,
  FormControl,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import { ThemeProvider } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import AccessibilityBadge from "../components/AccessibilityBadge";
import { THEME_OPTIONS, getThemeByKey } from "../themes";

const THEME_STORAGE_KEY = "filterPageTheme";

function getInitialThemeKey() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEME_OPTIONS.some((option) => option.key === stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }

  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "obsidian";
  }

  return "govuk";
}

function ExternalToolCard({ title, href, description }) {
  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: "background.paper",
        borderColor: "divider",
      }}
    >
      <CardContent sx={{ pb: "16px !important" }}>
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
          {description}
        </Typography>
        <MuiLink
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ wordBreak: "break-all" }}
        >
          {href}
        </MuiLink>
      </CardContent>
    </Card>
  );
}

export default function AccessibilityStatement() {
  const [themeKey, setThemeKey] = useState(getInitialThemeKey);
  const activeTheme = useMemo(() => getThemeByKey(themeKey), [themeKey]);
  const custom = activeTheme.custom || {};

  const handleThemeChange = (event) => {
    const nextKey = String(event.target.value || "govuk");
    setThemeKey(nextKey);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextKey);
    } catch {
      // localStorage unavailable
    }
  };

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const encodedCurrentUrl = encodeURIComponent(currentUrl);
  const waveLink = `https://wave.webaim.org/report#/${encodedCurrentUrl}`;

  const auditTools = [
    {
      title: "WAVE Web Accessibility Evaluator",
      href: waveLink,
      description: "Runs WAVE against the current page URL with a visual accessibility overlay.",
    },
    {
      title: "Google Lighthouse",
      href: "https://developer.chrome.com/docs/lighthouse/overview/",
      description: "Use Chrome DevTools > Lighthouse for built-in accessibility auditing.",
    },
    {
      title: "axe DevTools",
      href: "https://www.deque.com/axe/devtools/",
      description: "Browser extension for detailed WCAG testing and issue guidance.",
    },
    {
      title: "ANDI (Section 508)",
      href: "https://www.ssa.gov/accessibility/andi/help/install.html",
      description: "Bookmarklet-based accessibility testing tool for interactive review.",
    },
    {
      title: "Colour Contrast Analyser",
      href: "https://www.tpgi.com/color-contrast-checker/",
      description: "Check color pair contrast ratios against WCAG conformance thresholds.",
    },
    {
      title: "NVDA Screen Reader",
      href: "https://www.nvaccess.org/download/",
      description: "Free Windows screen reader for real-world keyboard and screen reader testing.",
    },
  ];

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          background: custom.pageBgExtra
            ? `${custom.pageBgExtra}, ${activeTheme.palette.background.default}`
            : undefined,
          p: { xs: 2, md: 4 },
        }}
      >
        <Box component="main" aria-labelledby="accessibility-title">
          <Container maxWidth="lg">
            <Stack spacing={2.5}>
              <Box
                component="header"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1.5,
                  flexWrap: "wrap",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <MuiLink component={RouterLink} to="/filters" underline="hover">
                    Back to Explorer
                  </MuiLink>
                  <AccessibilityBadge label="Accessibility" />
                </Stack>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <PaletteOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  <FormControl
                    size="small"
                    sx={{
                      minWidth: 130,
                      height: 32,
                      bgcolor: "background.paper",
                    }}
                  >
                    <InputLabel id="accessibility-theme-select-label">Theme</InputLabel>
                    <Select
                      labelId="accessibility-theme-select-label"
                      id="accessibility-theme-select"
                      value={themeKey}
                      onChange={handleThemeChange}
                      label="Theme"
                      sx={{
                        height: 32,
                        "& .MuiSelect-select": { py: 0.5 },
                      }}
                    >
                      {THEME_OPTIONS.map((option) => (
                        <MenuItem key={option.key} value={option.key} sx={{ fontSize: "0.8rem" }}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: "divider" }}>
                <Typography id="accessibility-title" component="h1" variant="h4" sx={{ fontWeight: 700 }}>
                  Accessibility Statement
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1.25 }}>
                  DeepPhe-Viz is committed to ensuring digital accessibility for all users, including
                  those who use assistive technologies. We strive to conform to WCAG 2.1 Level AA
                  standards.
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: "divider" }}>
                <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
                  Conformance Status
                </Typography>
                <Typography variant="body1" sx={{ mt: 1.25 }}>
                  <strong>Target:</strong> WCAG 2.1 Level AA
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5 }}>
                  <strong>Status:</strong> Partially conformant
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5 }}>
                  <strong>Automated testing:</strong> axe-core accessibility checks are integrated into
                  the development workflow.
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: "divider" }}>
                <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
                  Measures Taken
                </Typography>
                <Box component="ul" sx={{ pl: 2.5, mt: 1.25, mb: 0 }}>
                  <li>
                    <Typography variant="body1">
                      Integrated axe-core automated accessibility auditing in development
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1">
                      Semantic HTML and proper heading hierarchy across key views
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1">
                      Keyboard-navigable interactive chart controls
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1">
                      ARIA labeling and descriptive semantics on custom SVG-based visuals
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1">
                      High-contrast theme options (Obsidian, Solstice, Vapor)
                    </Typography>
                  </li>
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: "divider" }}>
                <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
                  Known Limitations
                </Typography>
                <Box component="ul" sx={{ pl: 2.5, mt: 1.25, mb: 0 }}>
                  <li>
                    <Typography variant="body1">
                      Automated tools typically identify only a subset of accessibility issues; manual
                      assistive-technology testing is ongoing.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1">
                      Complex SVG chart interactions may have limited support in some assistive
                      technology combinations.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1">
                      Data-dense views can create cognitive load for some users.
                    </Typography>
                  </li>
                </Box>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 2, md: 3 },
                  borderColor: "primary.main",
                  boxShadow: "0 0 0 1px rgba(77,208,225,0.25) inset",
                }}
              >
                <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
                  Audit Your Experience
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                  Use these live tools to validate any DeepPhe-Viz screen in your own environment.
                </Typography>
                <Box
                  sx={{
                    mt: 2,
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  {auditTools.map((tool) => (
                    <ExternalToolCard
                      key={tool.title}
                      title={tool.title}
                      href={tool.href}
                      description={tool.description}
                    />
                  ))}
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: "divider" }}>
                <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
                  Feedback and Contact
                </Typography>
                <Typography variant="body1" sx={{ mt: 1.25 }}>
                  We welcome your feedback on the accessibility of DeepPhe-Viz. If you encounter
                  accessibility barriers, please contact us at [EMAIL].
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: "divider" }}>
                <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
                  Standards Reference
                </Typography>
                <Box component="ul" sx={{ pl: 2.5, mt: 1.25, mb: 0 }}>
                  <li>
                    <MuiLink href="https://www.w3.org/TR/WCAG21/" target="_blank" rel="noopener noreferrer">
                      WCAG 2.1 Specification
                    </MuiLink>
                  </li>
                  <li>
                    <MuiLink
                      href="https://www.w3.org/WAI/WCAG21/Understanding/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Understanding WCAG 2.1
                    </MuiLink>
                  </li>
                  <li>
                    <MuiLink
                      href="https://www.w3.org/WAI/planning/statements/generator/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      W3C Accessibility Statement Generator
                    </MuiLink>
                  </li>
                </Box>
              </Paper>

              <Box component="nav" aria-label="Accessibility page navigation">
                <MuiLink component={RouterLink} to="/filters" underline="hover">
                  Back to Explorer
                </MuiLink>
              </Box>
            </Stack>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
