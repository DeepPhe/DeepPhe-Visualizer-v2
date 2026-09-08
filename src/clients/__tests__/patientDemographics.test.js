import {
  fetchPatientDemographics,
  resetPatientDemographicsCacheForTests,
} from "../patientDemographics";

const originalFetch = global.fetch;

const RECORDS = [{ PatientID: "fake_patient1", Gender: "female", DateOfBirth: "04-01-1960" }];

describe("patient demographics client", () => {
  afterEach(() => {
    resetPatientDemographicsCacheForTests();
    jest.clearAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  it("loads the bundled demographics asset", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => RECORDS }));

    await expect(fetchPatientDemographics()).resolves.toEqual(RECORDS);
    expect(global.fetch).toHaveBeenCalledWith("/data/demographics/patient_demographics.json");
  });

  it("fetches once and reuses the result", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => RECORDS }));

    await fetchPatientDemographics();
    await fetchPatientDemographics();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("resolves to an empty list rather than throwing when the asset is missing", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));

    // A failed demographics load must never break the patient profile load.
    await expect(fetchPatientDemographics()).resolves.toEqual([]);
  });

  it("resolves to an empty list on a network error", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("offline");
    });

    await expect(fetchPatientDemographics()).resolves.toEqual([]);
  });
});
