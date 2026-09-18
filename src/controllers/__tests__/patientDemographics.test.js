import {
  enrichPatientDemographics,
  findDemographicsBirthDate,
  findPatientDemographicsRecord,
  getAgeOnDate,
  parsePatientBirthDate,
  toIsoBirthDate,
} from "../patientDemographics";

const RECORDS = [
  {
    PatientID: "fake_patient1",
    PatientName: "Fake Patient1",
    Race: "white",
    Gender: "female",
    DateOfBirth: "04-01-1960",
  },
  {
    PatientID: "fake_patient2",
    PatientName: "Fake Patient2",
    Race: "black",
    Gender: "male",
    DateOfBirth: "06-15-1972",
  },
];

describe("patient demographics controller", () => {
  it("parses both the ISO and MM-DD-YYYY birth date shapes", () => {
    expect(parsePatientBirthDate("1960-04-01").getTime()).toBe(new Date(1960, 3, 1).getTime());
    expect(parsePatientBirthDate("04-01-1960").getTime()).toBe(new Date(1960, 3, 1).getTime());
    expect(parsePatientBirthDate("")).toBeNull();
    expect(parsePatientBirthDate("unknown")).toBeNull();
    expect(parsePatientBirthDate("1960-13-01")).toBeNull();
  });

  it("normalizes a birth date to ISO for display", () => {
    expect(toIsoBirthDate("04-01-1960")).toBe("1960-04-01");
    expect(toIsoBirthDate("1960-04-01")).toBe("1960-04-01");
    expect(toIsoBirthDate("nope")).toBe("");
  });

  it("counts whole years completed, not calendar-year differences", () => {
    // Birth dates, like the timelines' dates, are local midnight.
    const dob = new Date(1960, 3, 1);

    expect(getAgeOnDate(dob, new Date(2010, 2, 31))).toBe(49);
    expect(getAgeOnDate(dob, new Date(2010, 3, 1))).toBe(50);
  });

  it("looks records up by patient id", () => {
    expect(findPatientDemographicsRecord(RECORDS, "fake_patient2").Gender).toBe("male");
    expect(findPatientDemographicsRecord(RECORDS, "nobody")).toBeNull();
    expect(findPatientDemographicsRecord(null, "fake_patient1")).toBeNull();
    expect(findDemographicsBirthDate(RECORDS, "fake_patient1").getTime()).toBe(
      new Date(1960, 3, 1).getTime()
    );
  });

  it("fills blank demographic fields from the asset", () => {
    const profile = {
      patientId: "fake_patient1",
      demographics: {
        gender: "",
        race: "",
        ethnicity: "",
        birthDate: "",
        firstEncounterDate: "2010-01-23",
        lastEncounterDate: "2011-03-01",
      },
    };

    const enriched = enrichPatientDemographics(profile, RECORDS);

    expect(enriched.demographics).toMatchObject({
      gender: "female",
      race: "white",
      birthDate: "1960-04-01",
      patientName: "Fake Patient1",
      // encounter dates come from the patient's own documents, not the asset
      firstEncounterDate: "2010-01-23",
      lastEncounterDate: "2011-03-01",
    });
  });

  it("never overwrites a value the API supplied", () => {
    const profile = {
      patientId: "fake_patient1",
      demographics: { gender: "nonbinary", race: "asian", birthDate: "1961-02-02" },
    };

    expect(enrichPatientDemographics(profile, RECORDS).demographics).toMatchObject({
      gender: "nonbinary",
      race: "asian",
      birthDate: "1961-02-02",
    });
  });

  it("leaves the profile untouched when no record matches", () => {
    const profile = { patientId: "real-patient-9", demographics: { gender: "" } };

    expect(enrichPatientDemographics(profile, RECORDS)).toBe(profile);
    expect(enrichPatientDemographics(null, RECORDS)).toBeNull();
  });
});
