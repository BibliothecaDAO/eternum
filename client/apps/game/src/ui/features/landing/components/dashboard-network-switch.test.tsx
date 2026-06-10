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
  getChainLabel: (chain: string) => (chain === "mainnet" ? "Mainnet" : "Slot"),
}));

const buildLandingNetworkState = (overrides: Partial<ReturnType<typeof mocks.useLandingNetworkState>> = {}) => {
  return {
    connectedChain: "slot",
    connectedLandingChain: "slot",
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

  it("renders Mainnet before Slot", async () => {
    await act(async () => {
      root.render(<DashboardNetworkSwitch />);
      await waitForAsyncWork();
    });

    const buttonLabels = Array.from(container.querySelectorAll("button")).map((button) => button.textContent);

    expect(buttonLabels).toEqual(["Mainnet", "Slot"]);
  });

  it("swaps the preferred game chain and wallet network when the user picks another chain", async () => {
    await act(async () => {
      root.render(<DashboardNetworkSwitch />);
      await waitForAsyncWork();
    });

    const slotButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Slot"),
    );

    expect(slotButton).toBeDefined();

    await act(async () => {
      slotButton?.click();
      await waitForAsyncWork();
    });

    expect(mocks.switchToPreferredChain).toHaveBeenCalledWith("slot");
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
    const slotButton = buttons.find((button) => button.textContent?.includes("Slot"));
    const mainnetButton = buttons.find((button) => button.textContent?.includes("Mainnet"));

    expect(mainnetButton?.getAttribute("aria-pressed")).toBe("true");
    expect(slotButton?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      slotButton?.click();
      await waitForAsyncWork();
    });

    expect(mocks.selectPreferredChain).toHaveBeenCalledWith("slot");
    expect(slotButton?.getAttribute("aria-pressed")).toBe("true");
    expect(mainnetButton?.getAttribute("aria-pressed")).toBe("false");
  });
});
