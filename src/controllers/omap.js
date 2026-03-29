import {
  fetchOmopClasses,
  fetchOmopInstances,
  fetchOmopSummary,
} from "../clients/deepphe-data-api";

export async function getClasses() {
  return fetchOmopClasses();
}

export async function getInstances(attribute, options = {}) {
  return fetchOmopInstances({ attribute, ...options });
}

export async function getSummary(options = {}) {
  return fetchOmopSummary(options);
}
