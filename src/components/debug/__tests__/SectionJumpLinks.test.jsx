import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import SectionJumpLinks from "../SectionJumpLinks";

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

describe("SectionJumpLinks", () => {
  it("renders one link per value with expected href", () => {
    const onJump = jest.fn(() => () => {});
    const { container, unmount } = renderComponent(
      <SectionJumpLinks sectionKey="omop" values={["Value1", "Value2"]} onJump={onJump} />
    );

    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe("Value1");
    expect(links[0].getAttribute("href")).toBe("#omop-value1");
    expect(links[1].textContent).toBe("Value2");
    expect(links[1].getAttribute("href")).toBe("#omop-value2");

    unmount();
  });

  it("renders nothing for empty values", () => {
    const onJump = jest.fn(() => () => {});
    const { container, unmount } = renderComponent(
      <SectionJumpLinks sectionKey="omop" values={[]} onJump={onJump} />
    );

    expect(container.innerHTML).toBe("");
    unmount();
  });

  it("wires click handlers from onJump callback", () => {
    const clickHandler = jest.fn((event) => event.preventDefault());
    const onJump = jest.fn(() => clickHandler);

    const { container, unmount } = renderComponent(
      <SectionJumpLinks sectionKey="attributes" values={["Behavior"]} onJump={onJump} />
    );

    expect(onJump).toHaveBeenCalledWith("attributes", "Behavior");

    const link = container.querySelector("a");
    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(clickHandler).toHaveBeenCalled();
    unmount();
  });

  it("normalizes special characters in anchor ids", () => {
    const onJump = jest.fn(() => () => {});
    const { container, unmount } = renderComponent(
      <SectionJumpLinks
        sectionKey="concepts"
        values={["Age@Dx", " Multi   Space "]}
        onJump={onJump}
      />
    );

    const links = container.querySelectorAll("a");
    expect(links[0].getAttribute("href")).toBe("#concepts-age-dx");
    expect(links[1].getAttribute("href")).toBe("#concepts-multi-space");

    unmount();
  });
});
