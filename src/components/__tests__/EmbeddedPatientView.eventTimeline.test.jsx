/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import EmbeddedPatientView from "../EmbeddedPatientView";
import { usePatientData } from "../../hooks/usePatientData";
import { resetStaticEventRelationTimelineCacheForTests } from "../../clients/eventRelationTimeline";
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

const TEST_TSV = [
  "PatientID\tConceptID\tRelation1\tDate1\tRelation2\tDate2",
  "fake_patient1\tc-treatment\tOn\t2010-05-31\tOn\t2010-05-31",
].join("\n");

const originalFetch = global.fetch;

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

function mockTimelineFetch() {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => TEST_TSV,
  }));
}

function mockPatientHook(patientId) {
  usePatientData.mockReturnValue({
    patientData: {
      patientId,
      patientName: patientId,
      demographics: {},
      documents: [],
      concepts: [
        {
          id: "c-treatment",
          name: "Chemotherapy",
          dpheGroup: "Intervention or Procedure",
          mentionIds: ["m-treatment"],
        },
      ],
      cancers: [],
    },
    timelineData: { reportData: [], reportTypes: [], episodeCounts: {} },
    cancerSummary: [],
    isLoading: false,
    errorMessage: "",
    loadPatient: jest.fn(async () => ({
      patientData: { patientId },
      timelineData: { reportData: [] },
    })),
  });
}

describe("EmbeddedPatientView event relation timeline integration", () => {
  beforeEach(() => {
    mockTimelineFetch();
    getInstances.mockResolvedValue([]);
    loadPatientFilterSummary.mockResolvedValue([]);
  });

  afterEach(() => {
    resetStaticEventRelationTimelineCacheForTests();
    jest.clearAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  it("renders the event relation panel for fake_patient1", async () => {
    mockPatientHook("fake_patient1");
    const { container, unmount } = renderComponent(
      <EmbeddedPatientView patientId="fake_patient1" />
    );

    try {
      await waitFor(() => {
        expect(container.querySelector('[data-testid="patient-event-relation-panel"]')).not.toBeNull();
      });

      expect(container.textContent).toContain("Event Timeline");
      await waitFor(() => {
        expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(1);
      });
    } finally {
      unmount();
    }
  });

  it("does not render the event relation panel for other patients", () => {
    mockPatientHook("patient-2");
    const { container, unmount } = renderComponent(<EmbeddedPatientView patientId="patient-2" />);

    expect(container.querySelector('[data-testid="patient-event-relation-panel"]')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    unmount();
  });
});
