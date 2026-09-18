import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_VIEWPORT,
  ZOOM_STEP,
  canPanEarlier,
  canPanLater,
  canZoomIn,
  isViewportZoomed,
  normalizeViewport,
  panViewport,
  viewportsEqual,
  zoomViewport,
} from "../utils/patientView/timelineViewport";

// Pointer travel, in SVG units, before a press on the plot becomes a pan drag
// rather than a click on whatever is under it.
export const PLOT_DRAG_THRESHOLD = 5;
// Range announcements wait this long after the last change, so a drag or a held
// arrow key doesn't flood screen readers.
export const RANGE_ANNOUNCEMENT_DELAY_MS = 300;

/**
 * Maps a pointer's clientX into the SVG's viewBox x. jsdom has no SVG geometry,
 * so there clientX is taken to already be in viewBox units, which lets pointer
 * tests drive the range logic directly.
 */
export function clientXToSvgX(svg, clientX) {
  if (!svg) {
    return null;
  }

  if (typeof svg.getScreenCTM === "function" && typeof svg.createSVGPoint === "function") {
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const svgPoint = svg.createSVGPoint();
      svgPoint.x = clientX;
      svgPoint.y = 0;
      return svgPoint.matrixTransform(ctm.inverse()).x;
    }
  }

  const viewBoxValues = String(svg.getAttribute("viewBox") || "")
    .split(/\s+/)
    .map(Number);
  const viewBoxWidth = Number.isFinite(viewBoxValues[2]) ? viewBoxValues[2] : 0;
  const rect = typeof svg.getBoundingClientRect === "function" ? svg.getBoundingClientRect() : null;
  if (rect && rect.width > 0 && viewBoxWidth > 0) {
    return ((clientX - rect.left) / rect.width) * viewBoxWidth + viewBoxValues[0];
  }

  return Number.isFinite(clientX) ? clientX : null;
}

/**
 * Zoom and pan state for a patient timeline's overview + detail view.
 *
 * The `{ zoom, panRatio }` viewport is the single source of truth: the detail
 * axis, the marks and the overview window all read it, so they can't drift
 * apart. It is ratio-based, so resizing the chart or collapsing a lane keeps
 * the reader's date range. It resets when `resetKey` changes (a new patient or
 * a new date domain).
 *
 * `describeRange(viewport)` returns the text announced, debounced, after the
 * reader changes the range.
 */
export default function useTimelineViewport({ resetKey = "", describeRange = undefined } = {}) {
  const [viewport, setViewportState] = useState(DEFAULT_VIEWPORT);
  const [announcement, setAnnouncement] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const describeRangeRef = useRef(describeRange);
  describeRangeRef.current = describeRange;
  const shouldAnnounceRef = useRef(false);
  const suppressClickRef = useRef(false);
  const endDragRef = useRef(null);

  useEffect(() => {
    shouldAnnounceRef.current = false;
    setViewportState(DEFAULT_VIEWPORT);
  }, [resetKey]);

  useEffect(
    () => () => {
      endDragRef.current?.();
    },
    []
  );

  // Every reader-driven change goes through here and is announced; the reset
  // above is not, so loading a new patient isn't read out as a range change.
  // Pass `{ announce: false }` for changes the reader didn't make.
  const setViewport = useCallback((nextViewport, { announce = true } = {}) => {
    setViewportState((previous) => {
      const candidate =
        typeof nextViewport === "function" ? nextViewport(previous) : nextViewport;
      if (!candidate) {
        return previous;
      }
      const next = normalizeViewport(candidate);
      if (viewportsEqual(previous, next)) {
        return previous;
      }
      if (announce) {
        shouldAnnounceRef.current = true;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!shouldAnnounceRef.current) {
      return undefined;
    }
    shouldAnnounceRef.current = false;
    const timer = window.setTimeout(() => {
      setAnnouncement(describeRangeRef.current ? describeRangeRef.current(viewport) : "");
    }, RANGE_ANNOUNCEMENT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [viewport]);

  const zoomIn = useCallback(
    (anchorFraction) => setViewport((current) => zoomViewport(current, ZOOM_STEP, anchorFraction)),
    [setViewport]
  );
  const zoomOut = useCallback(
    (anchorFraction) =>
      setViewport((current) => zoomViewport(current, 1 / ZOOM_STEP, anchorFraction)),
    [setViewport]
  );
  const panEarlier = useCallback(
    () => setViewport((current) => panViewport(current, -1)),
    [setViewport]
  );
  const panLater = useCallback(
    () => setViewport((current) => panViewport(current, 1)),
    [setViewport]
  );
  const reset = useCallback(() => setViewport(DEFAULT_VIEWPORT), [setViewport]);

  /** `+`/`=` zoom in, `-`/`_` zoom out, `0` resets, `←`/`→` pan. */
  const handlePlotKeyDown = useCallback(
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const actions = {
        "+": zoomIn,
        "=": zoomIn,
        "-": zoomOut,
        _: zoomOut,
        0: reset,
        ArrowLeft: panEarlier,
        ArrowRight: panLater,
      };
      const action = actions[event.key];
      if (!action) {
        return;
      }
      event.preventDefault();
      action();
    },
    [panEarlier, panLater, reset, zoomIn, zoomOut]
  );

  /**
   * Press-and-drag on the plot pans a zoomed chart. Window listeners (not
   * pointer capture) keep clicks on the marks working; a drag that moved
   * swallows the click that follows it (see `consumeDragClick`).
   * `clientToX` maps clientX into the plot's SVG units.
   */
  const handlePlotPointerDown = useCallback(
    (event, { clientToX, plotWidth }) => {
      if (event.button !== 0 || !isViewportZoomed(viewportRef.current) || !(plotWidth > 0)) {
        return;
      }
      const startX = clientToX(event.clientX);
      if (startX == null) {
        return;
      }
      // Stop the browser starting a text or element selection mid-drag.
      event.preventDefault();
      endDragRef.current?.();

      const startPanRatio = viewportRef.current.panRatio;
      let moved = false;
      setIsDragging(true);

      const handleMove = (moveEvent) => {
        const x = clientToX(moveEvent.clientX);
        if (x == null) {
          return;
        }
        const deltaX = x - startX;
        if (!moved && Math.abs(deltaX) < PLOT_DRAG_THRESHOLD) {
          return;
        }
        moved = true;
        setViewport((current) => ({
          zoom: current.zoom,
          panRatio: startPanRatio - deltaX / (plotWidth * current.zoom),
        }));
      };
      const endDrag = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
        endDragRef.current = null;
        setIsDragging(false);
        if (moved) {
          suppressClickRef.current = true;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
      endDragRef.current = endDrag;
    },
    [setViewport]
  );

  /** True (once) when a click was the tail end of a pan drag and should be ignored. */
  const consumeDragClick = useCallback(() => {
    if (!suppressClickRef.current) {
      return false;
    }
    suppressClickRef.current = false;
    return true;
  }, []);

  const isZoomed = isViewportZoomed(viewport);

  return {
    viewport,
    setViewport,
    zoomIn,
    zoomOut,
    panEarlier,
    panLater,
    reset,
    handlePlotKeyDown,
    handlePlotPointerDown,
    consumeDragClick,
    isDragging,
    announcement,
    isZoomed,
    zoomPercent: Math.round(viewport.zoom * 100),
    canZoomIn: canZoomIn(viewport),
    canZoomOut: isZoomed,
    canPanEarlier: canPanEarlier(viewport),
    canPanLater: canPanLater(viewport),
    canReset: isZoomed,
  };
}
