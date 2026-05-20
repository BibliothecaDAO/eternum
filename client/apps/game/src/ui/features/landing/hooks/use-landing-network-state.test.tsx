// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLandingNetworkState } from "./use-landing-network-state";

const mocks = vi.hoisted(() => ({
  useAccount: vi.fn(),
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: mocks.useAccount,
}));

const CHAIN_KEY = "ACTIVE_WORLD_CHAIN";

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const LandingNetworkStateProbe = () => {
  const state = useLandingNetworkState();

  return (
    <div data-preferred-chain={state.preferredChain} data-status={state.status}>
      <button type="button" onClick={() => state.selectPreferredChain("slot")}>
        Select slot
      </button>
    </div>
  );
};

const getPreferredChain = (container: HTMLElement) => {
  return container.querySelector("[data-preferred-chain]")?.getAttribute("data-preferred-chain");
};

const renderProbe = async (root: Root) => {
  await act(async () => {
    root.render(<LandingNetworkStateProbe />);
    await waitForAsyncWork();
  });
};

describe("useLandingNetworkState", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    mocks.useAccount.mockReset();
    mocks.useAccount.mockReturnValue({
      address: undefined,
      chainId: null,
      connector: null,
    });

    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await waitForAsyncWork();
    });

    container.remove();
    window.localStorage.clear();
    vi.restoreAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("defaults first-time users to mainnet without persisting a preference", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    await renderProbe(root);

    const selectedChainWrites = setItemSpy.mock.calls.filter(([key]) => key === CHAIN_KEY);
    expect(getPreferredChain(container)).toBe("mainnet");
    expect(window.localStorage.getItem(CHAIN_KEY)).toBeNull();
    expect(selectedChainWrites).toEqual([]);
  });

  it("keeps a saved slot preference after refresh", async () => {
    window.localStorage.setItem(CHAIN_KEY, "slot");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    await renderProbe(root);

    expect(getPreferredChain(container)).toBe("slot");
    expect(window.localStorage.getItem(CHAIN_KEY)).toBe("slot");
    expect(setItemSpy.mock.calls.filter(([key]) => key === CHAIN_KEY)).toEqual([]);
  });

  it("keeps a saved mainnet preference after refresh", async () => {
    window.localStorage.setItem(CHAIN_KEY, "mainnet");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    await renderProbe(root);

    expect(getPreferredChain(container)).toBe("mainnet");
    expect(window.localStorage.getItem(CHAIN_KEY)).toBe("mainnet");
    expect(setItemSpy.mock.calls.filter(([key]) => key === CHAIN_KEY)).toEqual([]);
  });

  it("persists explicit network selection", async () => {
    await renderProbe(root);

    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(getPreferredChain(container)).toBe("slot");
    expect(window.localStorage.getItem(CHAIN_KEY)).toBe("slot");
  });
});
