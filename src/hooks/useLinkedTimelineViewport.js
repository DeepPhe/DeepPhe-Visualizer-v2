import { useContext, useEffect } from "react";
import useTimelineViewport from "./useTimelineViewport";
import { TimelineLinkContext } from "../components/patient/timeline/TimelineLinkProvider";

/**
 * A timeline's zoom and pan state, linked to every other timeline under the same
 * TimelineLinkProvider, or its own when there is no provider.
 *
 * - `id`: unique among the linked timelines.
 * - `domain`: this timeline's own `{ startDate, endDate }`, or null while it has
 *   nothing to draw. Linked timelines render against the returned `domain`,
 *   which covers every linked timeline's data.
 * - `priority`: the lowest-priority linked timeline announces range changes.
 * - `resetKey`, `describeRange`: used only when unlinked (see useTimelineViewport).
 *
 * Returns everything useTimelineViewport does, plus `domain`, `isLinked`, and
 * `isAnnouncer` (whether this timeline should render the range live region).
 */
export default function useLinkedTimelineViewport({
  id,
  domain = null,
  priority = 0,
  resetKey = "",
  describeRange = undefined,
}) {
  const link = useContext(TimelineLinkContext);
  const local = useTimelineViewport({
    resetKey: link ? "" : resetKey,
    describeRange: link ? undefined : describeRange,
  });

  const registerTimeline = link?.registerTimeline;
  const unregisterTimeline = link?.unregisterTimeline;
  const startMs = domain?.startDate instanceof Date ? domain.startDate.getTime() : NaN;
  const endMs = domain?.endDate instanceof Date ? domain.endDate.getTime() : NaN;

  useEffect(() => {
    if (!registerTimeline || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return undefined;
    }
    registerTimeline(id, { startDate: new Date(startMs), endDate: new Date(endMs) }, priority);
    return () => unregisterTimeline(id);
  }, [registerTimeline, unregisterTimeline, id, startMs, endMs, priority]);

  if (!link) {
    return { ...local, domain, isLinked: false, isAnnouncer: true };
  }

  return {
    ...link,
    // Until this timeline has registered, the shared domain may not cover it.
    domain: link.domain || domain,
    isLinked: true,
    isAnnouncer: link.announcerId === id,
  };
}
