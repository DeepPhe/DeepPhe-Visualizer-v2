import React, { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  TextField,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";
import { THEME_STORAGE_KEY, getThemeByKey } from "../themes";

// The endpoint is provided by the deployment (e.g. the demo's viz-server), not
// the app itself. On deployments without it the POST simply fails and the user
// sees a retry message — the widget stays self-contained.
const FEEDBACK_ENDPOINT = "/feedback";
const CLOSE_AFTER_SUCCESS_MS = 1500;

function resolveTheme() {
  try {
    return getThemeByKey(localStorage.getItem(THEME_STORAGE_KEY) || "obsidian");
  } catch (error) {
    return getThemeByKey("obsidian");
  }
}

function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = resolveTheme();

  const closeDialog = () => {
    if (isSubmitting) {
      return;
    }
    setIsOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus({ type: "warning", message: "Please add a note before sending." });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          email: email.trim(),
          path: window.location.pathname + window.location.search,
        }),
      });

      if (!response.ok) {
        throw new Error(`Feedback request failed: ${response.status}`);
      }

      setStatus({ type: "success", message: "Thanks — your feedback was sent." });
      setText("");
      setEmail("");
      window.setTimeout(() => setIsOpen(false), CLOSE_AFTER_SUCCESS_MS);
    } catch (error) {
      setStatus({
        type: "error",
        message: "Sorry, that did not send. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Fab
        color="primary"
        variant="extended"
        onClick={() => setIsOpen(true)}
        aria-label="Give feedback about this tool"
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: (muiTheme) => muiTheme.zIndex.speedDial,
          textTransform: "none",
        }}
      >
        <FeedbackOutlinedIcon sx={{ mr: 1 }} />
        Feedback
      </Fab>

      <Dialog
        open={isOpen}
        onClose={closeDialog}
        aria-labelledby="dphe-feedback-title"
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={handleSubmit}>
          <DialogTitle id="dphe-feedback-title">Share your thoughts</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Anything at all — what worked, what got in the way, what is missing.
              A sentence or a page, both help.
            </Typography>
            <TextField
              label="Your feedback"
              multiline
              minRows={4}
              fullWidth
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="e.g. I couldn't tell how to combine two filters. The link back to the source note was really useful."
              inputProps={{ maxLength: 5000 }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Email (optional — only if you'd like a reply)"
              type="email"
              fullWidth
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.org"
              inputProps={{ maxLength: 200 }}
            />
            {status ? (
              <Alert severity={status.type} sx={{ mt: 2 }} role="status">
                {status.message}
              </Alert>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send feedback"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </ThemeProvider>
  );
}

export default FeedbackWidget;
