/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container, testing-library/no-node-access */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import TimelineLinkProvider from "../TimelineLinkProvider";
import useLinkedTimelineViewport from "../../../../hooks/useLinkedTimelineViewport";
import PatientDocumentsCard from "../../PatientDocumentsCard";
import EventRelationTimelineCard from "../../EventRelationTimelineCard";
import { transformDocumentTimeline } from "../../../../utils/patientView/transformDocumentTimeline";
import { resetStaticEventRelationTimelineCacheForTests } from "../../../../clients/eventRelationTimeline";
import {
  DOCUMENT_CHART_BORDER_WIDTH,
  TIMELINE_PLOT_INSET,
} from "../../../../constants/timelineFrame";

const DOCUMENTS_DOMAIN = { startDate: new Date(2010, 0, 1), endDate: new Date(2011, 0, 1) };
const EVENTS_DOMAIN = { startDate: new Date(2009, 0, 1), endDate: new Date(2011, 0, 1) };

function renderRoot(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    rerender: (next) =>
      act(() => {
        root.render(next);
      }),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function Probe({ id, domain, priority, results }) {
  // eslint-disable-next-line no-param-reassign
  results[id] = useLinkedTimelineViewport({ id, domain, priority });
  return null;
}

describe("TimelineLinkProvider", () => {
  it("shares one viewport and one domain covering every linked timeline", () => {
    const results = {};
    const { unmount } = renderRoot(
      <TimelineLinkProvider resetKey="patient-1">
        <Probe id="documents" domain={DOCUMENTS_DOMAIN} priority={0} results={results} />
        <Probe id="events" domain={EVENTS_DOMAIN} priority={1} results={results} />
      </TimelineLinkProvider>
    );

    expect(results.documents.isLinked).toBe(true);
    expect(results.documents.domain).toEqual(EVENTS_DOMAIN);
    expect(results.events.domain).toEqual(EVENTS_DOMAIN);
    // One live region: the lowest priority announces.
    expect(results.documents.isAnnouncer).toBe(true);
    expect(results.events.isAnnouncer).toBe(false);

    act(() => results.events.zoomIn());
    expect(results.documents.viewport).toEqual(results.events.viewport);
    expect(results.documents.zoomPercent).toBe(150);

    act(() => results.documents.panLater());
    expect(results.events.viewport).toEqual(results.documents.viewport);
    expect(results.events.canPanEarlier).toBe(true);

    unmount();
  });

  it("keeps a zoomed range on screen when a late timeline widens the domain", () => {
    const results = {};
    const tree = (withEvents) => (
      <TimelineLinkProvider resetKey="patient-1">
        <Probe id="documents" domain={DOCUMENTS_DOMAIN} priority={0} results={results} />
        {withEvents ? (
          <Probe id="events" domain={EVENTS_DOMAIN} priority={1} results={results} />
        ) : null}
      </TimelineLinkProvider>
    );
    const { rerender, unmount } = renderRoot(tree(false));
    expect(results.documents.domain).toEqual(DOCUMENTS_DOMAIN);

    act(() => results.documents.zoomIn());
    act(() => results.documents.zoomIn());
    const shownBefore = viewportDates(results.documents.viewport, DOCUMENTS_DOMAIN);

    rerender(tree(true));
    expect(results.documents.domain).toEqual(EVENTS_DOMAIN);
    const shownAfter = viewportDates(results.documents.viewport, EVENTS_DOMAIN);
    expect(shownAfter.start).toBeCloseTo(shownBefore.start, -1);
    expect(shownAfter.end).toBeCloseTo(shownBefore.end, -1);

    // Leaving drops that timeline's data from the domain again.
    rerender(tree(false));
    expect(results.documents.domain).toEqual(DOCUMENTS_DOMAIN);

    unmount();
  });

  it("opens a widened domain at 100% when the reader hasn't zoomed", () => {
    const results = {};
    const tree = (withEvents) => (
      <TimelineLinkProvider resetKey="patient-1">
        <Probe id="documents" domain={DOCUMENTS_DOMAIN} priority={0} results={results} />
        {withEvents ? (
          <Probe id="events" domain={EVENTS_DOMAIN} priority={1} results={results} />
        ) : null}
      </TimelineLinkProvider>
    );
    const { rerender, unmount } = renderRoot(tree(false));
    rerender(tree(true));
    expect(results.documents.viewport).toEqual({ zoom: 1, panRatio: 0 });
    unmount();
  });

  it("resets for a new patient, and leaves unlinked timelines independent", () => {
    const results = {};
    const tree = (resetKey) => (
      <>
        <TimelineLinkProvider resetKey={resetKey}>
          <Probe id="documents" domain={DOCUMENTS_DOMAIN} priority={0} results={results} />
        </TimelineLinkProvider>
        <Probe id="alone" domain={EVENTS_DOMAIN} priority={0} results={results} />
      </>
    );
    const { rerender, unmount } = renderRoot(tree("patient-1"));

    expect(results.alone.isLinked).toBe(false);
    expect(results.alone.isAnnouncer).toBe(true);
    expect(results.alone.domain).toEqual(EVENTS_DOMAIN);

    act(() => results.documents.zoomIn());
    expect(results.alone.zoomPercent).toBe(100);

    rerender(tree("patient-2"));
    expect(results.documents.viewport).toEqual({ zoom: 1, panRatio: 0 });

    unmount();
  });
});

function viewportDates(viewport, domain) {
  const spanMs = domain.endDate.getTime() - domain.startDate.getTime();
  return {
    start: domain.startDate.getTime() + viewport.panRatio * spanMs,
    end: domain.startDate.getTime() + (viewport.panRatio + 1 / viewport.zoom) * spanMs,
  };
}

describe("linked document and event timelines", () => {
  const TSV = [
    "PatientID\tConceptID\tRelation1\tDate1\tRelation2\tDate2",
    "fake_patient1\tc-finding\tOverlaps\t2009-06-01\tOverlaps\t2010-03-01",
    "fake_patient1\tc-treatment\tOn\t2010-05-31\tOn\t2010-05-31",
  ].join("\n");
  const CONCEPTS = [
    { id: "c-finding", name: "Estrogen Receptor Status", dpheGroup: "Clinical Test Result", mentionIds: [] },
    { id: "c-treatment", name: "Chemotherapy", dpheGroup: "Intervention or Procedure", mentionIds: [] },
  ];
  const TIMELINE_DATA = transformDocumentTimeline({
    patientId: "fake_patient1",
    patientName: "Fake Patient1",
    documents: [
      { id: "doc-1", name: "One", date: "201001250900", type: "Clinical note", episode: "Diagnostic" },
      { id: "doc-2", name: "Two", date: "201006151000", type: "Clinical note", episode: "Diagnostic" },
      { id: "doc-3", name: "Three", date: "201011221100", type: "Pathology", episode: "Treatment" },
    ],
  });
  // The Event Timeline measures its container; the document chart measures the
  // box inside its 1px border. Same column, so the Event container is 2px wider.
  const CONTENT_WIDTH = 1200;
  const originalFetch = global.fetch;
  const OriginalResizeObserver = global.ResizeObserver;

  beforeEach(() => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => TSV }));
    global.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback;
      }

      observe(node) {
        const isDocumentChart = Boolean(
          node.querySelector?.("svg[aria-label='Patient document timeline chart']")
        );
        const width = isDocumentChart
          ? CONTENT_WIDTH - 2 * DOCUMENT_CHART_BORDER_WIDTH
          : CONTENT_WIDTH;
        this.callback([{ contentRect: { width } }]);
      }

      disconnect() {}
    };
  });

  afterEach(() => {
    resetStaticEventRelationTimelineCacheForTests();
    global.fetch = originalFetch;
    global.ResizeObserver = OriginalResizeObserver;
  });

  async function renderLinked() {
    const view = renderRoot(
      <TimelineLinkProvider resetKey="fake_patient1">
        <PatientDocumentsCard timelineData={TIMELINE_DATA} />
        <EventRelationTimelineCard patientId="fake_patient1" concepts={CONCEPTS} />
      </TimelineLinkProvider>
    );
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (view.container.querySelector("[data-testid='event-timeline-overview']")) {
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    return view;
  }

  // Handle and window positions relative to each card's content edge, which is
  // where the two cards line up in the patient views.
  function stripGeometry(container, prefix) {
    const selection = container.querySelector(`[data-testid='${prefix}-slider-selection']`);
    const band = container.querySelector(`[data-testid='${prefix}-overview-band']`);
    const offset =
      prefix === "document-timeline"
        ? DOCUMENT_CHART_BORDER_WIDTH
        : Number(
            /translate\(([\d.]+),/.exec(
              container.querySelector(".overview").getAttribute("transform")
            )[1]
          );
    const at = (node, attribute) => Number(node.getAttribute(attribute)) + (attribute === "x" ? offset : 0);
    return {
      bandLeft: at(band, "x"),
      bandRight: at(band, "x") + Number(band.getAttribute("width")),
      windowLeft: at(selection, "x"),
      windowWidth: Number(selection.getAttribute("width")),
      startLabel: container
        .querySelector(`[data-testid='${prefix}-slider-start']`)
        .getAttribute("aria-valuetext"),
    };
  }

  it("lines both strips up and moves the event slider with the document slider", async () => {
    const { container, unmount } = await renderLinked();
    try {
      const documents = stripGeometry(container, "document-timeline");
      const events = stripGeometry(container, "event-timeline");

      // Same plot edges from the content edge, so the same pixels.
      expect(documents.bandLeft).toBe(TIMELINE_PLOT_INSET.left);
      expect(events.bandLeft).toBe(TIMELINE_PLOT_INSET.left);
      expect(documents.bandRight).toBe(events.bandRight);
      expect(CONTENT_WIDTH - events.bandRight).toBe(TIMELINE_PLOT_INSET.right);

      // One shared domain: events start in 2009, so the documents' strip does too.
      const overviewLabels = (prefix) =>
        [...container.querySelectorAll(`[data-testid='${prefix}-overview-axis'] text`)].map(
          (node) => node.textContent
        );
      expect(overviewLabels("document-timeline")[0]).toBe("Apr 2009");
      expect(overviewLabels("event-timeline")[0]).toBe("Apr 2009");

      // Drag the document timeline's start handle to the middle of its band.
      const startHandle = container.querySelector("[data-testid='document-timeline-slider-start']");
      // jsdom keeps MouseEvent clientX an integer.
      const from = documents.windowLeft - DOCUMENT_CHART_BORDER_WIDTH;
      const to = Math.round(from + documents.windowWidth / 2);
      act(() => {
        startHandle.dispatchEvent(
          new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, clientX: from })
        );
        window.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: to }));
        window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: to }));
      });

      const draggedDocuments = stripGeometry(container, "document-timeline");
      const draggedEvents = stripGeometry(container, "event-timeline");
      expect(draggedDocuments.windowLeft).toBeCloseTo(to + DOCUMENT_CHART_BORDER_WIDTH, 6);
      expect(draggedEvents.windowLeft).toBeCloseTo(draggedDocuments.windowLeft, 6);
      expect(draggedEvents.windowWidth).toBeCloseTo(draggedDocuments.windowWidth, 6);
      expect(draggedEvents.startLabel).toBe(draggedDocuments.startLabel);
      expect(container.textContent).not.toContain("100%");

      // And back the other way, from the Event Timeline's controls.
      act(() => {
        container
          .querySelector('button[aria-label="Reset event timeline zoom"]')
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(stripGeometry(container, "document-timeline").windowWidth).toBeCloseTo(
        documents.windowWidth,
        6
      );

      // One live region between the two cards.
      expect(container.querySelectorAll("[aria-live='polite'][data-testid$='-range-status']")).toHaveLength(1);
      expect(container.querySelector("[data-testid='document-timeline-range-status']")).not.toBeNull();
    } finally {
      unmount();
    }
  });
});
