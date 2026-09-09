import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Tooltip } from "./tooltip";

const stubPointer = (coarse: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: coarse && query === "(pointer: coarse)" }));

describe("Tooltip", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    useTooltipStore.setState({ tooltip: null });
    vi.unstubAllGlobals();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders the hover tooltip on a fine pointer", async () => {
    stubPointer(false);
    await act(async () => root.render(<Tooltip />));
    await act(async () => useTooltipStore.getState().setTooltip({ content: "hint", fixed: { x: 10, y: 10 } }));
    expect(document.getElementById("tooltip-root")?.textContent).toBe("hint");
  });

  it("renders nothing on a coarse pointer, where a tap would leave it stuck", async () => {
    stubPointer(true);
    await act(async () => root.render(<Tooltip />));
    await act(async () => useTooltipStore.getState().setTooltip({ content: "hint", fixed: { x: 10, y: 10 } }));
    expect(document.getElementById("tooltip-root")).toBeNull();
  });
});
