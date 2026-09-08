/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PatientDemographicsCard from "../PatientDemographicsCard";

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
      act(() => root.unmount());
      container.remove();
    },
  };
}

const PATIENT = {
  patientId: "fake_patient1",
  demographics: {
    gender: "female",
    race: "white",
    ethnicity: "",
    birthDate: "1960-04-01",
    firstEncounterDate: "2010-01-23",
    lastEncounterDate: "2011-03-01",
  },
};

function readFields(container) {
  const grid = container.querySelector("[data-testid='patient-demographics-grid']");
  return [...grid.children].map((item) => ({
    label: item.children[0].textContent,
    value: item.children[1].textContent,
    // jsdom reports "" for an undeclared property.
    textTransform: getComputedStyle(item.children[1]).textTransform || "none",
  }));
}

describe("PatientDemographicsCard", () => {
  it("flows the fields across a responsive grid rather than one column", () => {
    const { container, unmount } = renderComponent(
      <PatientDemographicsCard patientData={PATIENT} />
    );

    try {
      const grid = container.querySelector("[data-testid='patient-demographics-grid']");
      expect(getComputedStyle(grid).display).toBe("grid");
      expect(getComputedStyle(grid).gridTemplateColumns).toContain("auto-fit");
      expect(grid.children).toHaveLength(6);
    } finally {
      unmount();
    }
  });

  it("renders the demographic values supplied by the profile", () => {
    const { container, unmount } = renderComponent(
      <PatientDemographicsCard patientData={PATIENT} />
    );

    try {
      expect(readFields(container)).toEqual([
        { label: "Patient ID", value: "fake_patient1", textTransform: "none" },
        { label: "Gender", value: "female", textTransform: "capitalize" },
        { label: "Race/Ethnicity", value: "white", textTransform: "capitalize" },
        { label: "Birth Date", value: "1960-04-01", textTransform: "none" },
        { label: "First Encounter", value: "2010-01-23", textTransform: "none" },
        { label: "Last Encounter", value: "2011-03-01", textTransform: "none" },
      ]);
    } finally {
      unmount();
    }
  });

  it("joins race and ethnicity when both are present", () => {
    const { container, unmount } = renderComponent(
      <PatientDemographicsCard
        patientData={{
          ...PATIENT,
          demographics: { ...PATIENT.demographics, ethnicity: "non-hispanic" },
        }}
      />
    );

    try {
      const raceField = readFields(container).find((f) => f.label === "Race/Ethnicity");
      expect(raceField.value).toBe("white / non-hispanic");
    } finally {
      unmount();
    }
  });

  it("falls back to Unknown for missing values without capitalizing the patient id", () => {
    const { container, unmount } = renderComponent(
      <PatientDemographicsCard patientData={{ patientId: "real_patient_9" }} />
    );

    try {
      const fields = readFields(container);
      expect(fields.find((f) => f.label === "Gender").value).toBe("Unknown");
      expect(fields.find((f) => f.label === "Birth Date").value).toBe("Unknown");
      // A capitalized patient id would misrepresent the identifier.
      expect(fields.find((f) => f.label === "Patient ID")).toMatchObject({
        value: "real_patient_9",
        textTransform: "none",
      });
    } finally {
      unmount();
    }
  });
});
