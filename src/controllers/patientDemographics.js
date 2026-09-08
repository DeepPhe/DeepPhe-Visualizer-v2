/**
 * Patient demographics: parsing birth dates, deriving ages, and filling gaps in
 * the deepphe payload from the bundled demographics asset.
 *
 * The API returns an empty `demographics` object for the bundled fake patients,
 * so gender / race / birth date come from
 * public/data/demographics/patient_demographics.json (ported from
 * DeepPhe-Viz-v2-alpha). Anything the API does supply always wins.
 */

function normalizeString(value) {
  return String(value || "").trim();
}

/**
 * Accepts the ISO `birthDate` the deepphe payload normalizes to, and the
 * MM-DD-YYYY `DateOfBirth` used by the bundled demographics asset.
 * Returns null for anything unparseable -- callers omit the age axis rather
 * than fall back to a guess.
 */
export function parsePatientBirthDate(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
  const monthFirst = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(normalized);

  let year;
  let monthIndex;
  let day;

  if (iso) {
    year = Number(iso[1]);
    monthIndex = Number(iso[2]) - 1;
    day = Number(iso[3]);
  } else if (monthFirst) {
    year = Number(monthFirst[3]);
    monthIndex = Number(monthFirst[1]) - 1;
    day = Number(monthFirst[2]);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, monthIndex, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/** "YYYY-MM-DD", or "" when the value cannot be parsed. */
export function toIsoBirthDate(value) {
  const date = parsePatientBirthDate(value);
  if (!date) {
    return "";
  }

  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/** Whole years completed at `onDate`. */
export function getAgeOnDate(birthDate, onDate) {
  if (!(birthDate instanceof Date) || !(onDate instanceof Date)) {
    return null;
  }

  let age = onDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDelta = onDate.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && onDate.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }

  return age;
}

export function findPatientDemographicsRecord(records, patientId) {
  const normalizedPatientId = normalizeString(patientId);
  if (!normalizedPatientId) {
    return null;
  }

  return (
    (Array.isArray(records) ? records : []).find(
      (entry) => normalizeString(entry?.PatientID) === normalizedPatientId
    ) || null
  );
}

export function findDemographicsBirthDate(records, patientId) {
  const record = findPatientDemographicsRecord(records, patientId);
  return parsePatientBirthDate(record?.DateOfBirth);
}

/**
 * Fill blank demographic fields from the bundled asset. Encounter dates are
 * left alone -- those are derived from the patient's own documents and are
 * more trustworthy than the asset's copies.
 */
export function enrichPatientDemographics(profile, records) {
  if (!profile) {
    return profile;
  }

  const record = findPatientDemographicsRecord(records, profile.patientId);
  if (!record) {
    return profile;
  }

  const demographics = profile.demographics || {};
  const preferApi = (apiValue, assetValue) =>
    normalizeString(apiValue) || normalizeString(assetValue);

  return {
    ...profile,
    demographics: {
      ...demographics,
      patientName: preferApi(demographics.patientName, record.PatientName),
      gender: preferApi(demographics.gender, record.Gender),
      race: preferApi(demographics.race, record.Race),
      birthDate:
        normalizeString(demographics.birthDate) || toIsoBirthDate(record.DateOfBirth),
    },
  };
}
