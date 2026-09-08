/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PatientDocumentDrawer from "../PatientDocumentDrawer";

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
    mentions: [{ id: "m-neoplasm", begin: 0, end: 5, confidence: 0.95 }],
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
  ];
}

describe("PatientDocumentDrawer", () => {
  it("renders the document viewer in a modal drawer and closes from the header", () => {
    const onClose = jest.fn();
    const { unmount } = renderComponent(
      <PatientDocumentDrawer
        open
        document={buildDocumentPayload()}
        concepts={buildConceptPayload()}
        onClose={onClose}
        confidenceThreshold={50}
      />
    );

    const drawer = document.body.querySelector('[data-testid="patient-document-drawer"]');
    expect(drawer).not.toBeNull();
    expect(drawer.getAttribute("role")).toBe("dialog");
    expect(drawer.getAttribute("aria-modal")).toBe("true");
    expect(drawer.getAttribute("aria-label")).toContain("Clinical Note");
    expect(document.body.textContent).toContain("Tumor");

    const closeButton = drawer.querySelector('button[aria-label="Close document"]');
    act(() => {
      closeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("closes on backdrop click", () => {
    const onClose = jest.fn();
    const { unmount } = renderComponent(
      <PatientDocumentDrawer
        open
        document={buildDocumentPayload()}
        concepts={buildConceptPayload()}
        onClose={onClose}
        confidenceThreshold={50}
      />
    );

    const backdrop = document.body.querySelector(
      '[data-testid="patient-document-drawer-backdrop"]'
    );
    expect(backdrop).not.toBeNull();

    act(() => {
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("handles Escape without bubbling to the parent patient drawer", () => {
    const onClose = jest.fn();
    const onAncestorKeyDown = jest.fn();
    const { unmount } = renderComponent(
      <div onKeyDown={onAncestorKeyDown}>
        <PatientDocumentDrawer
          open
          document={buildDocumentPayload()}
          concepts={buildConceptPayload()}
          onClose={onClose}
          confidenceThreshold={50}
        />
      </div>
    );

    const drawer = document.body.querySelector('[data-testid="patient-document-drawer"]');
    expect(drawer).not.toBeNull();

    act(() => {
      drawer.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAncestorKeyDown).not.toHaveBeenCalled();
    unmount();
  });
});
