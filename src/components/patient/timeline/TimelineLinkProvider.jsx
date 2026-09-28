import React, { createContext, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import useTimelineViewport from "../../../hooks/useTimelineViewport";
import {
  describeViewportRange,
  rebaseViewport,
  sameDateDomain,
} from "../../../utils/patientView/timelineViewport";

export const TimelineLinkContext = createContext(null);

/**
 * Links every patient timeline rendered inside it: one zoom and pan state, one
 * date range covering every linked timeline's data, and one screen-reader
 * announcement. Moving a slider, button or key in any linked timeline moves them
 * all, and with the shared frame (constants/timelineFrame.js) their strips and
 * handles line up.
 *
 * Renders no DOM. Timelines join through useLinkedTimelineViewport; outside a
 * provider each timeline keeps its own state.
 */
export default function TimelineLinkProvider({ resetKey = "", children }) {
  // id -> { startMs, endMs, priority }
  const [registrations, setRegistrations] = useState({});

  const registerTimeline = useCallback((id, domain, priority = 0) => {
    const startMs = domain.startDate.getTime();
    const endMs = domain.endDate.getTime();
    setRegistrations((previous) => {
      const current = previous[id];
      if (
        current &&
        current.startMs === startMs &&
        current.endMs === endMs &&
        current.priority === priority
      ) {
        return previous;
      }
      return { ...previous, [id]: { startMs, endMs, priority } };
    });
  }, []);

  const unregisterTimeline = useCallback((id) => {
    setRegistrations((previous) => {
      if (!(id in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, []);

  const entries = Object.entries(registrations);
  const startMs = entries.length ? Math.min(...entries.map(([, entry]) => entry.startMs)) : NaN;
  const endMs = entries.length ? Math.max(...entries.map(([, entry]) => entry.endMs)) : NaN;
  const domain = useMemo(
    () =>
      Number.isFinite(startMs) && Number.isFinite(endMs)
        ? { startDate: new Date(startMs), endDate: new Date(endMs) }
        : null,
    [startMs, endMs]
  );

  // The linked timeline with the lowest priority owns the live region, so a
  // range change is announced once, not once per timeline.
  const announcerId = entries.length
    ? entries.reduce((best, entry) => (entry[1].priority < best[1].priority ? entry : best))[0]
    : null;

  const viewportApi = useTimelineViewport({
    resetKey,
    describeRange: (viewport) =>
      domain ? describeViewportRange(viewport, domain.startDate, domain.endDate) : "",
  });
  const { setViewport } = viewportApi;

  // A timeline's data can arrive after another's (the Event Timeline loads
  // separately) and widen the shared domain. Keep a zoomed reader's dates on
  // screen instead of letting their window drift. Layout effect, so the chart
  // never paints the old viewport against the new domain.
  const previousDomainRef = useRef(domain);
  useLayoutEffect(() => {
    const previous = previousDomainRef.current;
    previousDomainRef.current = domain;
    if (!previous || !domain || sameDateDomain(previous, domain)) {
      return;
    }
    setViewport((current) => rebaseViewport(current, previous, domain), { announce: false });
  }, [domain, setViewport]);

  const value = {
    ...viewportApi,
    domain,
    announcerId,
    registerTimeline,
    unregisterTimeline,
  };

  return <TimelineLinkContext.Provider value={value}>{children}</TimelineLinkContext.Provider>;
}

TimelineLinkProvider.propTypes = {
  resetKey: PropTypes.string,
  children: PropTypes.node,
};
