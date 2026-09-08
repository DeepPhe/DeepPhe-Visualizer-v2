import {
  EVENT_RELATION_TIMELINE_ASSET_PATH,
  FAKE_PATIENT_EVENT_TIMELINE_ID,
} from "../constants/eventRelationTimeline";

let fakePatientEventTimelineTextPromise = null;

function resolveStaticAssetUrl(assetPath) {
  const basePath = String(process.env.PUBLIC_URL || "").replace(/\/$/, "");
  return `${basePath}${assetPath}`;
}

export async function fetchStaticEventRelationTimeline(patientId) {
  const normalizedPatientId = String(patientId || "").trim();
  if (normalizedPatientId !== FAKE_PATIENT_EVENT_TIMELINE_ID) {
    return "";
  }

  if (!fakePatientEventTimelineTextPromise) {
    const url = resolveStaticAssetUrl(EVENT_RELATION_TIMELINE_ASSET_PATH);
    fakePatientEventTimelineTextPromise = fetch(url).then(async (response) => {
      if (!response?.ok) {
        throw new Error(
          `Unable to load event relation timeline data (${response?.status || "network error"}).`
        );
      }
      return response.text();
    });
  }

  return fakePatientEventTimelineTextPromise;
}

export function resetStaticEventRelationTimelineCacheForTests() {
  fakePatientEventTimelineTextPromise = null;
}
