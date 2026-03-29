import {
  fetchCancersClasses,
  fetchCancersInstances,
  fetchCancersSummary,
} from "../clients/deepphe-data-api";

export async function getClasses() {
  return fetchCancersClasses();
}

export async function getInstances(classUri, options = {}) {
  return fetchCancersInstances({ classUri, ...options });
}

export async function getSummary(options = {}) {
  return fetchCancersSummary(options);
}
