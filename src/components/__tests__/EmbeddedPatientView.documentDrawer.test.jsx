/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import EmbeddedPatientView from "../EmbeddedPatientView";
import { usePatientData } from "../../hooks/usePatientData";
import { getInstances } from "../../controllers/omap";
import { loadPatientFilterSummary } from "../../controllers/patient";

jest.mock("../../hooks/usePatientData", () => ({
  usePatientData: jest.fn(),
}));

jest.mock("../../controllers/omap", () => ({
  getInstances: jest.fn(),
}));

jest.mock("../../controllers/patient", () => ({
  loadPatientFilterSummary: jest.fn(),
}));

jest.mock("../patient/CancerTumorSummaryCard", () => {
  const React = require("react");

  return function MockCancerTumorSummaryCard(props) {
    return React.createElement(
      "section",
      { "data-testid": "mock-cancer-card" },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => props.onSelectDocument?.("doc-3"),
        },
        "Open related document"
      )
    );
  };
});

jest.mock("../patient/PatientDocumentsCard", () => {
  const React = require("react");

  return function MockPatientDocumentsCard(props) {
    return React.createElement(
      "section",
      { "data-testid": "mock-document-timeline-card" },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => props.onSelectDocument?.("doc-1"),
        },
        "Open timeline document"
      ),
      React.createElement("span", null, ` selected:${props.selectedDocumentId || "none"}`)
    );
  };
});

jest.mock("../patient/EventRelationTimelineCard", () => {
  const React = require("react");

  return function MockEventRelationTimelineCard(props) {
    return React.createElement(
      "section",
      { "data-testid": "mock-event-timeline-card" },
      `Event Timeline selected:${props.selectedDocument?.id || "none"}`
    );
  };
});

jest.mock("../patient/PatientSummaryCard", () => {
  const React = require("react");

  return function MockPatientSummaryCard(props) {
    const selection = {
      factId: "summary-diagnosis",
      categoryName: "Diagnoses",
      prettyName: "Invasive breast carcinoma",
      documentIds: ["doc-1", "doc-2"],
      documentRanking: [
        { documentId: "doc-1", confidence: 1 },
        { documentId: "doc-2", confidence: 0.9 },
      ],
    };

    return React.createElement(
      "section",
      { "data-testid": "mock-summary-card" },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => props.onSelectItem?.(selection),
        },
        "Open summary item"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => props.onSelectDocumentForItem?.(selection, "doc-2"),
        },
        "Open summary document"
      ),
      React.createElement("span", null, ` selected:${props.selectedDocumentId || "none"}`)
    );
  };
});

function renderComponent(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function waitFor(assertion, timeoutMs = 3000) {
  const start = Date.now();

  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - start > timeoutMs) {
        throw error;
      }

      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
}

function buildDocument(id, name, text) {
  return {
    id,
    name,
    text,
    mentions: [{ id: `${id}-mention`, begin: 0, end: 5, confidence: 1 }],
  };
}

function buildPatientData(patientId = "fake_patient1") {
  const documents = [
    buildDocument("doc-1", "Clinical Note", "Tumor documented in timeline note."),
    buildDocument("doc-2", "Pathology Report", "Tumor documented in pathology report."),
    buildDocument("doc-3", "Related Consult", "Tumor documented in related consult."),
  ];

  return {
    patientId,
    patientName: patientId,
    demographics: {},
    documents,
    concepts: [
      {
        id: "concept-neoplasm",
        name: "Neoplasm",
        classUri: "Neoplasm",
        dpheGroup: "Neoplasm",
        mentionIds: documents.flatMap((document) =>
          document.mentions.map((mention) => mention.id)
        ),
      },
    ],
    cancers: [],
    rawPatient: {
      diagnoses: [{ name: "Invasive breast carcinoma" }],
    },
  };
}

function mockPatientHook(patientId = "fake_patient1") {
  const patientData = buildPatientData(patientId);

  usePatientData.mockReturnValue({
    patientData,
    timelineData: {
      reportData: [
        { id: "doc-1", type: "NOTE", formattedDate: "2010/05/31", episode: "Treatment" },
        { id: "doc-2", type: "PATH", formattedDate: "2010/06/10", episode: "Diagnosis" },
        { id: "doc-3", type: "CONSULT", formattedDate: "2010/06/11", episode: "Diagnosis" },
      ],
      reportTypes: ["NOTE", "PATH", "CONSULT"],
      episodeCounts: {},
    },
    cancerSummary: [],
    isLoading: false,
    errorMessage: "",
    loadPatient: jest.fn(async () => null),
  });
}

describe("EmbeddedPatientView document drawer layout", () => {
  beforeEach(() => {
    getInstances.mockResolvedValue([]);
    loadPatientFilterSummary.mockResolvedValue([]);
    mockPatientHook("fake_patient1");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the embedded patient cards as full-width rows in the requested order", async () => {
    const { container, unmount } = renderComponent(
      <EmbeddedPatientView patientId="fake_patient1" />
    );

    try {
      await flushEffects();

      const rowStack = container.querySelector('[data-testid="patient-detail-row-stack"]');
      expect(rowStack).not.toBeNull();
      expect(rowStack.children).toHaveLength(4);
      expect(Array.from(rowStack.children).map((node) => node.getAttribute("data-testid"))).toEqual([
        "patient-cancer-panel",
        "patient-timeline-panel",
        "patient-event-relation-panel",
        "patient-summary-panel",
      ]);
      expect(container.querySelector('[data-testid="patient-left-rail"]')).toBeNull();
      expect(container.querySelector('[data-testid="patient-right-rail"]')).toBeNull();
      expect(container.querySelector('[data-testid="patient-document-panel"]')).toBeNull();
    } finally {
      unmount();
    }
  });

  it("opens timeline, summary, and related documents in the right drawer", async () => {
    const { container, unmount } = renderComponent(
      <EmbeddedPatientView patientId="fake_patient1" />
    );

    try {
      await flushEffects();

      act(() => {
        container
          .querySelector('[data-testid="mock-document-timeline-card"] button')
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="patient-document-drawer"]')).not.toBeNull();
        expect(document.body.textContent).toContain("Clinical Note");
        expect(
          container.querySelector('[data-testid="mock-event-timeline-card"]').textContent
        ).toContain("selected:doc-1");
      });

      act(() => {
        container
          .querySelector('[data-testid="mock-summary-card"] button:nth-of-type(2)')
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      await waitFor(() => {
        expect(document.body.textContent).toContain("Pathology Report");
        expect(
          container.querySelector('[data-testid="mock-event-timeline-card"]').textContent
        ).toContain("selected:doc-2");
      });

      act(() => {
        container
          .querySelector('[data-testid="mock-cancer-card"] button')
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      await waitFor(() => {
        expect(document.body.textContent).toContain("Related Consult");
        expect(
          container.querySelector('[data-testid="mock-event-timeline-card"]').textContent
        ).toContain("selected:doc-3");
      });

      expect(container.querySelector('[data-testid="patient-document-panel"]')).toBeNull();

      const closeButton = document.body.querySelector(
        '[data-testid="patient-document-drawer"] button[aria-label="Close document"]'
      );
      act(() => {
        closeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="patient-document-drawer"]')).toBeNull();
        expect(
          container.querySelector('[data-testid="mock-event-timeline-card"]').textContent
        ).toContain("selected:none");
      });
    } finally {
      unmount();
    }
  });
});
