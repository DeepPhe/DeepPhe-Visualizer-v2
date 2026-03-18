import {
  fetchCancersClasses,
  fetchCancersInstances,
} from "../clients/deepphe-data-api";

export async function getClasses() {
  return fetchCancersClasses();
}

export async function getInstances(classUri, options = {}) {
  return fetchCancersInstances({ classUri, ...options });
}
