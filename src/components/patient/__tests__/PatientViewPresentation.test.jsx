/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container, testing-library/no-node-access */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PatientViewPresentationProvider from "../PatientViewPresentationProvider";
import PatientViewPresentationToggle from "../PatientViewPresentationToggle";
import usePatientViewPresentation from "../../../hooks/usePatientViewPresentation";
import {
  DEFAULT_PATIENT_VIEW_PRESENTATION,
  PATIENT_VIEW_PRESENTATION_STORAGE_KEY,
} from "../../../constants/patientViewPresentation";

function renderRoot(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function Probe({ seen }) {
  const presentation = usePatientViewPresentation();
  // eslint-disable-next-line no-param-reassign
  seen.current = presentation;
  return <span data-testid="probe">{presentation.presentation}</span>;
}

describe("patient view presentation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("opens on the improved view and switches on the radio", () => {
    const seen = { current: null };
    const { container, unmount } = renderRoot(
      <PatientViewPresentationProvider>
        <PatientViewPresentationToggle />
        <Probe seen={seen} />
      </PatientViewPresentationProvider>
    );

    expect(seen.current.presentation).toBe(DEFAULT_PATIENT_VIEW_PRESENTATION);
    expect(seen.current.isImproved).toBe(true);
    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(2);
    expect(container.querySelector('[data-testid="patient-view-presentation-improved"]').checked).toBe(
      true
    );

    act(() => {
      container.querySelector('[data-testid="patient-view-presentation-alpha"]').click();
    });

    expect(seen.current.presentation).toBe("alpha");
    expect(seen.current.isAlpha).toBe(true);
    expect(localStorage.getItem(PATIENT_VIEW_PRESENTATION_STORAGE_KEY)).toBe("alpha");

    unmount();
  });

  it("remembers the choice for the next visit, and ignores a bad stored value", () => {
    localStorage.setItem(PATIENT_VIEW_PRESENTATION_STORAGE_KEY, "alpha");
    const seen = { current: null };
    const first = renderRoot(
      <PatientViewPresentationProvider>
        <Probe seen={seen} />
      </PatientViewPresentationProvider>
    );
    expect(seen.current.isAlpha).toBe(true);
    first.unmount();

    localStorage.setItem(PATIENT_VIEW_PRESENTATION_STORAGE_KEY, "nonsense");
    const second = renderRoot(
      <PatientViewPresentationProvider>
        <Probe seen={seen} />
      </PatientViewPresentationProvider>
    );
    expect(seen.current.presentation).toBe(DEFAULT_PATIENT_VIEW_PRESENTATION);
    second.unmount();
  });

  it("reports the default for a panel rendered without a provider", () => {
    const seen = { current: null };
    const { unmount } = renderRoot(<Probe seen={seen} />);

    expect(seen.current.presentation).toBe(DEFAULT_PATIENT_VIEW_PRESENTATION);
    // Writes are ignored rather than throwing.
    act(() => seen.current.setPresentation("alpha"));
    expect(seen.current.presentation).toBe(DEFAULT_PATIENT_VIEW_PRESENTATION);

    unmount();
  });

  it("is announced as a labelled radio group", () => {
    const { container, unmount } = renderRoot(
      <PatientViewPresentationProvider>
        <PatientViewPresentationToggle />
      </PatientViewPresentationProvider>
    );

    const group = container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    const label = container.querySelector(`#${group.getAttribute("aria-labelledby")}`);
    expect(label.textContent).toBe("View");
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Improved");

    unmount();
  });
});
