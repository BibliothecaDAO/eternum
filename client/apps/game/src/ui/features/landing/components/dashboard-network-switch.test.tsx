// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardNetworkSwitch } from "./dashboard-network-switch";

const mocks = vi.hoisted(() => ({
  selectPreferredChain: vi.fn(),
  switchToPreferredChain: vi.fn(),
  useLandingNetworkState: vi.fn(),
}));

vi.mock("../hooks/use-landing-network-state", () => ({
  useLandingNetworkState: mocks.useLandingNetworkState,
}));

vi.mock("@/ui/utils/network-switch", () => ({
  getChainLabel: (chain: string) => (chain === "mainnet" ? "Mainnet" : "Appchain"),
}));

const buildLandingNetworkState = (overrides: Partial<ReturnType<typeof mocks.useLandingNetworkState>> = {}) => {
  return {
    connectedChain: "appchain",
    connectedLandingChain: "appchain",
    hasConnectedWallet: true,
    preferredChain: "mainnet",
    selectPreferredChain: mocks.selectPreferredChain,
    status: "mismatched",
    switchToPreferredChain: mocks.switchToPreferredChain,
    ...overrides,
  };
};

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("DashboardNetworkSwitch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    mocks.selectPreferredChain.mockReset();
    mocks.switchToPreferredChain.mockReset();
    mocks.switchToPreferredChain.mockResolvedValue(true);
    mocks.useLandingNetworkState.mockReset();
    mocks.useLandingNetworkState.mockReturnValue(buildLandingNetworkState());

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
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders Mainnet before Appchain", async () => {
    await act(async () => {
      root.render(<DashboardNetworkSwitch />);
      await waitForAsyncWork();
    });

    const buttonLabels = Array.from(container.querySelectorAll("button")).map((button) => button.textContent);

    expect(buttonLabels).toEqual(["Mainnet", "Appchain"]);
  });

  it("swaps the preferred game chain and wallet network when the user picks another chain", async () => {
    await act(async () => {
      root.render(<DashboardNetworkSwitch />);
      await waitForAsyncWork();
    });

    const appchainButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Appchain"),
    );

    expect(appchainButton).toBeDefined();

    await act(async () => {
      appchainButton?.click();
      await waitForAsyncWork();
    });

    expect(mocks.switchToPreferredChain).toHaveBeenCalledWith("appchain");
  });

  it("updates the selected button immediately after changing the preferred chain without waiting for wallet state", async () => {
    mocks.useLandingNetworkState.mockReturnValue(
      buildLandingNetworkState({
        connectedChain: null,
        connectedLandingChain: null,
        hasConnectedWallet: false,
        status: "disconnected",
      }),
    );

    await act(async () => {
      root.render(<DashboardNetworkSwitch />);
      await waitForAsyncWork();
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const appchainButton = buttons.find((button) => button.textContent?.includes("Appchain"));
    const mainnetButton = buttons.find((button) => button.textContent?.includes("Mainnet"));

    expect(mainnetButton?.getAttribute("aria-pressed")).toBe("true");
    expect(appchainButton?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      appchainButton?.click();
      await waitForAsyncWork();
    });

    expect(mocks.selectPreferredChain).toHaveBeenCalledWith("appchain");
    expect(appchainButton?.getAttribute("aria-pressed")).toBe("true");
    expect(mainnetButton?.getAttribute("aria-pressed")).toBe("false");
  });
});
