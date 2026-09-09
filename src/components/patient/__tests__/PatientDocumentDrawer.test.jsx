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

  it("stacks above the Selected Patients drawer", () => {
    const { unmount } = renderComponent(
      <PatientDocumentDrawer open document={buildDocumentPayload()} concepts={[]} />
    );

    try {
      const paper = global.document.querySelector("[data-testid='patient-document-drawer']");
      const modalRoot = paper.closest(".MuiModal-root");
      const zIndex = Number(getComputedStyle(modalRoot).zIndex);

      // A temporary MUI Drawer defaults to zIndex.drawer (1200), which is below
      // the cohort view's Selected Patients drawer at zIndex.modal - 1 (1299),
      // so the viewer used to open behind it.
      expect(zIndex).toBeGreaterThan(1299);
      expect(zIndex).toBeGreaterThan(1200);
    } finally {
      unmount();
    }
  });

  it("opens inside the given container instead of over the page", () => {
    const container = global.document.createElement("div");
    global.document.body.appendChild(container);

    const { unmount } = renderComponent(
      <PatientDocumentDrawer
        open
        document={buildDocumentPayload()}
        concepts={[]}
        container={container}
      />
    );

    try {
      const paper = container.querySelector("[data-testid='patient-document-drawer']");
      // Portalled into the panel, not document.body.
      expect(paper).not.toBeNull();

      const modalRoot = paper.closest(".MuiModal-root");
      // inset:0 makes the root fill the panel so the paper's right:0 resolves
      // against it; overflow:hidden clips the slide-in transform, which would
      // otherwise widen the panel's scroll area and shift it sideways.
      expect(modalRoot.style.position).toBe("absolute");
      expect(modalRoot.style.inset).toBe("0");
      expect(modalRoot.style.overflow).toBe("hidden");
      expect(paper.style.position).toBe("absolute");

      const backdrop = container.querySelector(
        "[data-testid='patient-document-drawer-backdrop']"
      );
      expect(backdrop.style.position).toBe("absolute");
    } finally {
      unmount();
      container.remove();
    }
  });

  it("still opens as a page-level drawer with no container", () => {
    const { unmount } = renderComponent(
      <PatientDocumentDrawer open document={buildDocumentPayload()} concepts={[]} />
    );

    try {
      const paper = global.document.querySelector("[data-testid='patient-document-drawer']");
      const modalRoot = paper.closest(".MuiModal-root");
      expect(modalRoot.style.position).toBe("");
      expect(Number(getComputedStyle(modalRoot).zIndex)).toBeGreaterThan(1299);
    } finally {
      unmount();
    }
  });
});
