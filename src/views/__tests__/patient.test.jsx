/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container, testing-library/render-result-naming-convention */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import PatientView from "../patient";
import { loadPatientProfile, loadRandomPatientId } from "../../controllers/patient";

jest.mock("../../controllers/patient", () => ({
  loadPatientProfile: jest.fn(),
  loadRandomPatientId: jest.fn(),
}));

function renderComponent(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {element}
      </MemoryRouter>
    );
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

async function clickLoadPatientButton(container) {
  const submitButton = Array.from(container.querySelectorAll("button")).find((button) =>
    String(button.textContent || "").toLowerCase().includes("load patient")
  );
  expect(submitButton).toBeDefined();

  await act(async () => {
    submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

async function submitPatientId(container, patientId) {
  const input = container.querySelector('input[name="patient-id"]');
  expect(input).not.toBeNull();

  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;

  await act(async () => {
    nativeValueSetter?.call(input, patientId);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await clickLoadPatientButton(container);
}

async function clickRandomButton(container) {
  const randomButton = Array.from(container.querySelectorAll("button")).find((button) =>
    String(button.textContent || "").toLowerCase().includes("random")
  );
  expect(randomButton).toBeDefined();

  await act(async () => {
    randomButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

describe("PatientView", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("loads and renders patient details", async () => {
    loadPatientProfile.mockResolvedValueOnce({
      patientId: "fake_patient1",
      patientName: "fake_patient1",
      demographics: {
        patientName: "fake_patient1",
        gender: "F",
        firstEncounterDate: "2019-01-01",
        lastEncounterDate: "2020-01-01",
      },
      documents: [
        {
          id: "doc-1",
          name: "Doc 1",
          date: "202001011000",
          episode: "Diagnostic",
          type: "Clinical note",
          text: "This is clinical note text.",
          mentions: [],
        },
      ],
      concepts: [],
      cancers: [],
    });

    const rendered = renderComponent(<PatientView />);

    try {
      await submitPatientId(rendered.container, "fake_patient1");

      await waitFor(() => {
        expect(loadPatientProfile).toHaveBeenCalledWith("fake_patient1");
      });

      await waitFor(() => {
        expect(rendered.container.textContent).toContain("Loaded patient: fake_patient1");
      });

      expect(rendered.container.textContent).toContain("Patient Details");
      expect(rendered.container.textContent).toContain("Patient Document Timeline");
      // The viewer heading shows the auto-selected document's name, so assert
      // on the viewer's aria-live announcement instead of a static title.
      expect(rendered.container.textContent).toContain("Document viewer opened: Doc 1");
      expect(
        rendered.container.querySelector('svg[aria-label="Patient document timeline chart"]')
      ).not.toBeNull();
    } finally {
      rendered.unmount();
    }
  });

  test("shows error when patient lookup fails", async () => {
    loadPatientProfile.mockRejectedValueOnce(new Error("No patient found"));

    const rendered = renderComponent(<PatientView />);

    try {
      await submitPatientId(rendered.container, "missing-patient");

      await waitFor(() => {
        expect(rendered.container.textContent).toContain("No patient found");
      });
    } finally {
      rendered.unmount();
    }
  });

  test("fills patient input with a random patient ID", async () => {
    loadRandomPatientId.mockResolvedValueOnce("test_patient_random_1");

    const rendered = renderComponent(<PatientView />);

    try {
      await clickRandomButton(rendered.container);

      await waitFor(() => {
        expect(loadRandomPatientId).toHaveBeenCalledTimes(1);
      });

      const input = rendered.container.querySelector('input[name="patient-id"]');
      expect(input).not.toBeNull();
      expect(input?.value).toBe("test_patient_random_1");
    } finally {
      rendered.unmount();
    }
  });
});
