/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PatientDocumentViewerCard from "../PatientDocumentViewerCard";

function renderComponent(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function buildDocumentPayload() {
  return {
    id: "doc-1",
    name: "Clinical Note",
    text: "Tumor in left breast.",
    mentions: [
      { id: "m-neoplasm", begin: 0, end: 5, confidence: 0.95, negated: false },
      { id: "m-side", begin: 9, end: 13, confidence: 0.87, negated: true },
    ],
  };
}

function buildConceptPayload() {
  return [
    {
      id: "c-neoplasm",
      name: "Neoplasm",
      classUri: "Neoplasm",
      dpheGroup: "Neoplasm",
      mentionIds: ["m-neoplasm"],
    },
    {
      id: "c-side",
      name: "Side",
      classUri: "Side",
      dpheGroup: "Side",
      mentionIds: ["m-side"],
    },
  ];
}

describe("PatientDocumentViewerCard", () => {
  test("renders tabbed controls and does not render legacy slider controls", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentViewerCard document={buildDocumentPayload()} concepts={buildConceptPayload()} />
    );

    expect(container.textContent).toContain("Concept List");
    expect(container.textContent).toContain("Group Filter");
    expect(container.textContent).toContain("Confidence Filter");
    expect(container.querySelector('[aria-label="Mention confidence filter"]')).toBeNull();
    expect(container.textContent).not.toContain("Showing mentions with confidence >=");

    unmount();
  });

  test("renders highlighted mention overlay buttons in text pane", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentViewerCard document={buildDocumentPayload()} concepts={buildConceptPayload()} />
    );

    const mentionButtons = container.querySelectorAll('button[aria-label^="Mention "]');
    expect(mentionButtons.length).toBeGreaterThan(0);
    expect(container.textContent).toContain("Neoplasm (1)");
    expect(container.textContent).toContain("Side (1)");

    unmount();
  });
});
