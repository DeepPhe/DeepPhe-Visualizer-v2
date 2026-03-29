import {
  fetchConceptsClasses,
  fetchConceptsInstances,
  fetchConceptsSummary,
} from "../clients/deepphe-data-api";

export async function getClasses() {
  return fetchConceptsClasses();
}

export async function getInstances(dpheGroup, options = {}) {
  return fetchConceptsInstances({ dpheGroup, ...options });
}

export async function getSummary(options = {}) {
  return fetchConceptsSummary(options);
}
