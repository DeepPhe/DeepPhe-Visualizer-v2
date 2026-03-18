import { fetchOmopClasses, fetchOmopInstances } from "../clients/deepphe-data-api";

export async function getClasses() {
  return fetchOmopClasses();
}

export async function getInstances(attribute) {
  return fetchOmopInstances({ attribute });
}
