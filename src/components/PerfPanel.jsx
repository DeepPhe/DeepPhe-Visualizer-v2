import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { clearEvents, downloadAsJson, getEvents } from "../utils/perfTracker";

const EVENT_LIMIT = 100;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const parseTimestampFromId = (id) => {
  const idText = String(id || "");
  const firstDash = idText.indexOf("-");
  const secondDash = idText.indexOf("-", firstDash + 1);
  if (firstDash === -1 || secondDash === -1) {
    return "";
  }

  const timestampPart = Number(idText.slice(firstDash + 1, secondDash));
  if (!Number.isFinite(timestampPart) || timestampPart <= 0) {
    return "";
  }

  return new Date(timestampPart).toISOString();
};

function PerfPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState(() => {
    const nextEvents = getEvents();
    return Array.isArray(nextEvents) ? nextEvents : [];
  });

  useEffect(() => {
    if (IS_PRODUCTION || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.shiftKey && String(event.key || "").toLowerCase() === "p") {
        event.preventDefault();
        setIsOpen((previousState) => !previousState);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const updateRows = () => {
      const nextEvents = getEvents();
      setEvents(Array.isArray(nextEvents) ? nextEvents : []);
    };

    updateRows();
    const intervalId = window.setInterval(updateRows, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen]);

  const tableRows = useMemo(() => {
    const recentEvents = events.slice(-EVENT_LIMIT);
    const firstRowIndex = events.length - recentEvents.length + 1;
    return recentEvents.map((event, index) => ({
      rowIndex: firstRowIndex + index,
      type: event?.type || "",
      name: event?.name || "",
      duration: Number(event?.duration || 0).toFixed(2),
      status: event?.status || "",
      timestamp: parseTimestampFromId(event?.id),
      id: event?.id || `${firstRowIndex + index}`,
    }));
  }, [events]);

  if (IS_PRODUCTION) {
    return null;
  }

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 9999,
        width: isOpen ? "min(960px, calc(100vw - 32px))" : "auto",
      }}
    >
      <Paper elevation={6} sx={{ border: "1px solid", borderColor: "divider" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            p: 1,
          }}
        >
          <Typography variant="subtitle2">Perf Tracker ({events.length})</Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            {isOpen ? (
              <>
                <Button variant="outlined" size="small" onClick={downloadAsJson}>
                  Download JSON
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    clearEvents();
                    setEvents([]);
                  }}
                >
                  Clear
                </Button>
              </>
            ) : null}
            <Button variant="contained" size="small" onClick={() => setIsOpen((value) => !value)}>
              {isOpen ? "Hide" : "Show"}
            </Button>
          </Box>
        </Box>

        <Collapse in={isOpen} unmountOnExit>
          <TableContainer sx={{ maxHeight: "45vh" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>type</TableCell>
                  <TableCell>name</TableCell>
                  <TableCell>duration (ms)</TableCell>
                  <TableCell>status</TableCell>
                  <TableCell>timestamp</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.rowIndex}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.duration}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{row.timestamp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>
    </Box>
  );
}

export default PerfPanel;
