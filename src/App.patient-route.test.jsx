/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container, testing-library/render-result-naming-convention */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

function renderAppAtPath(pathname) {
  window.history.pushState({}, "", pathname);

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<App />);
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

describe("App patient route", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  test("home page contains patient navigation link", () => {
    // HomeView lives at /debug since FiltersView took over the root route.
    const rendered = renderAppAtPath("/debug");

    try {
      const patientLink = Array.from(rendered.container.querySelectorAll("a")).find((anchor) =>
        String(anchor.textContent || "").includes("Open Patient View")
      );
      expect(patientLink).toBeDefined();
      expect(patientLink?.getAttribute("href")).toBe("/patient");
    } finally {
      rendered.unmount();
    }
  });

  test("renders patient route", () => {
    const rendered = renderAppAtPath("/patient");

    try {
      expect(rendered.container.textContent).toContain("Patient View");
      expect(rendered.container.textContent).toContain("Patient Lookup");
    } finally {
      rendered.unmount();
    }
  });
});
