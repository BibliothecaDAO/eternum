import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";

import { WorldLoading } from "./world-loading";

const NO_LOADING = {
  [LoadingStateKey.Market]: false,
  [LoadingStateKey.AllPlayerStructures]: false,
  [LoadingStateKey.Hyperstructure]: false,
  [LoadingStateKey.MarketHistory]: false,
  [LoadingStateKey.Leaderboard]: false,
  [LoadingStateKey.Quest]: false,
  [LoadingStateKey.ChunkTransition]: false,
};

describe("WorldLoading", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useUIStore.setState({ loadingStates: NO_LOADING });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    useUIStore.setState({ loadingStates: NO_LOADING });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it.each([
    [LoadingStateKey.Market, "Gathering Merchants"],
    [LoadingStateKey.AllPlayerStructures, "Constructing Settlements"],
    [LoadingStateKey.Hyperstructure, "Awakening Ancient Powers"],
    [LoadingStateKey.MarketHistory, "Counting Gold"],
    [LoadingStateKey.Leaderboard, "Ranking Players"],
  ])("shows the labeled loading item for %s", async (key, label) => {
    useUIStore.setState({ loadingStates: { ...NO_LOADING, [key]: true } });

    await act(async () => {
      root.render(<WorldLoading />);
    });

    expect(container.querySelector('[role="status"]')?.textContent).toContain(label);
  });

  it.each([LoadingStateKey.ChunkTransition, LoadingStateKey.Quest])(
    "does not show an empty panel for unlabeled %s loading state",
    async (key) => {
      useUIStore.setState({ loadingStates: { ...NO_LOADING, [key]: true } });

      await act(async () => {
        root.render(<WorldLoading />);
      });

      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(container.querySelector("#world-loading")?.className).toContain("translate-y-full");
    },
  );
});
