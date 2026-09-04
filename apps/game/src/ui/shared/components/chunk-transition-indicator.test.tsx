import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";

import { ChunkTransitionIndicator } from "./chunk-transition-indicator";

describe("ChunkTransitionIndicator", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useUIStore.getState().setLoading(LoadingStateKey.ChunkTransition, false);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    useUIStore.getState().setLoading(LoadingStateKey.ChunkTransition, false);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("stays hidden while no terrain transition is active", async () => {
    await act(async () => {
      root.render(<ChunkTransitionIndicator />);
    });

    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("surfaces active terrain work as a passive status without a fullscreen dimmer", async () => {
    useUIStore.getState().setLoading(LoadingStateKey.ChunkTransition, true);

    await act(async () => {
      root.render(<ChunkTransitionIndicator />);
    });

    const status = container.querySelector<HTMLElement>('[role="status"]');
    expect(status?.textContent).toContain("Updating terrain");
    expect(status?.className).not.toContain("inset-0");
    expect(status?.style.backdropFilter).toBe("");
  });
});
