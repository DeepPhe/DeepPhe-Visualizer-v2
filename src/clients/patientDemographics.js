import { PATIENT_DEMOGRAPHICS_ASSET_PATH } from "../constants/eventRelationTimeline";

let demographicsPromise = null;

function resolveStaticAssetUrl(assetPath) {
  const basePath = String(process.env.PUBLIC_URL || "").replace(/\/$/, "");
  return `${basePath}${assetPath}`;
}

/**
 * Demographics for the bundled fake patients, ported from
 * DeepPhe-Viz-v2-alpha (public/docs/demographics/patient_demographics.json).
 * The deepphe API returns an empty `demographics` object for these patients, so
 * this static asset is the only source of birth dates for them.
 */
export async function fetchPatientDemographics() {
  if (!demographicsPromise) {
    const url = resolveStaticAssetUrl(PATIENT_DEMOGRAPHICS_ASSET_PATH);
    demographicsPromise = fetch(url)
      .then(async (response) => {
        if (!response?.ok) {
          throw new Error(
            `Unable to load patient demographics (${response?.status || "network error"}).`
          );
        }
        return response.json();
      })
      .catch(() => []);
  }

  return demographicsPromise;
}

export function resetPatientDemographicsCacheForTests() {
  demographicsPromise = null;
}
