// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { InfoBubble } from "./collapsible-bubble";

it("only toggles for the header's own keys, leaving nested action keys alone", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <InfoBubble title="Resources" cue={<button>Transfer</button>}>
          <p>Resource balance</p>
        </InfoBubble>,
      ),
    );
    const header = container.querySelector("[aria-expanded]")!;
    const button = container.querySelector("button")!;
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    await act(async () => {
      button.dispatchEvent(enter);
    });
    expect(enter.defaultPrevented).toBe(false);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    await act(async () => {
      header.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(header.getAttribute("aria-expanded")).toBe("false");
  } finally {
    await act(async () => root.unmount());
  }
});
