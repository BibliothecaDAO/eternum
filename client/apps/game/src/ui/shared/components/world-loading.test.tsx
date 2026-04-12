import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoadingStateKey } from "@/hooks/store/use-world-loading";

const uiStoreState = {
  loadingStates: {
    [LoadingStateKey.Map]: false,
  },
};

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (selector: (state: typeof uiStoreState) => unknown) => selector(uiStoreState),
}));

const { WorldLoading } = await import("./world-loading");

describe("WorldLoading", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    uiStoreState.loadingStates[LoadingStateKey.Map] = false;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("describes map loading as a refresh so chunk swaps do not read like first-load charting", async () => {
    uiStoreState.loadingStates[LoadingStateKey.Map] = true;

    await act(async () => {
      root.render(<WorldLoading />);
    });

    expect(container.textContent).toContain("Refreshing Territories");
    expect(container.textContent).not.toContain("Charting Territories");
  });
});
