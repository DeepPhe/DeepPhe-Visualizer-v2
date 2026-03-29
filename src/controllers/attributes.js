import {
  fetchAttributesClasses,
  fetchAttributesInstances,
  fetchAttributesSummary,
} from "../clients/deepphe-data-api";

export async function getClasses() {
  return fetchAttributesClasses();
}

export async function getInstances(groupname, options = {}) {
  return fetchAttributesInstances({ groupname, ...options });
}

export async function getSummary(options = {}) {
  return fetchAttributesSummary(options);
}
