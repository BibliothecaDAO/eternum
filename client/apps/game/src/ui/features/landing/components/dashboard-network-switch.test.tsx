// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardNetworkSwitch } from "./dashboard-network-switch";

const mocks = vi.hoisted(() => ({
  useAccount: vi.fn(),
  resolveChain: vi.fn(),
  setSelectedChain: vi.fn(),
  subscribeSelectedChain: vi.fn(),
  switchWalletToChain: vi.fn(),
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: mocks.useAccount,
}));

vi.mock("@/runtime/world", () => ({
  resolveChain: mocks.resolveChain,
  setSelectedChain: mocks.setSelectedChain,
  subscribeSelectedChain: mocks.subscribeSelectedChain,
}));

vi.mock("@/ui/utils/network-switch", () => ({
  getChainLabel: (chain: string) => (chain === "mainnet" ? "Mainnet" : "Slot"),
  resolveConnectedTxChainFromRuntime: () => "slot",
  switchWalletToChain: mocks.switchWalletToChain,
}));

const controller = {
  switchStarknetChain: vi.fn(),
  openSettings: vi.fn(),
  rpcUrl: vi.fn(),
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

    mocks.resolveChain.mockReturnValue("slot");
    mocks.setSelectedChain.mockReset();
    mocks.subscribeSelectedChain.mockReset();
    mocks.switchWalletToChain.mockReset();
    mocks.switchWalletToChain.mockResolvedValue(true);
    mocks.subscribeSelectedChain.mockReturnValue(() => {});
    mocks.useAccount.mockReturnValue({
      address: "0xabc",
      chainId: "0xslot",
      connector: { controller },
    });

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

  it("swaps the preferred game chain and wallet network when the user picks another chain", async () => {
    await act(async () => {
      root.render(<DashboardNetworkSwitch />);
      await waitForAsyncWork();
    });

    const mainnetButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Mainnet"),
    );

    expect(mainnetButton).toBeDefined();

    await act(async () => {
      mainnetButton?.click();
      await waitForAsyncWork();
    });

    expect(mocks.setSelectedChain).toHaveBeenCalledWith("mainnet");
    expect(mocks.switchWalletToChain).toHaveBeenCalledWith({
      controller,
      targetChain: "mainnet",
    });
  });

  it("updates the selected button immediately after changing the preferred chain without waiting for wallet state", async () => {
    mocks.useAccount.mockReturnValue({
      address: null,
      chainId: null,
      connector: undefined,
    });

    await act(async () => {
      root.render(<DashboardNetworkSwitch />);
      await waitForAsyncWork();
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const slotButton = buttons.find((button) => button.textContent?.includes("Slot"));
    const mainnetButton = buttons.find((button) => button.textContent?.includes("Mainnet"));

    expect(slotButton?.getAttribute("aria-pressed")).toBe("true");
    expect(mainnetButton?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      mainnetButton?.click();
      await waitForAsyncWork();
    });

    expect(mocks.setSelectedChain).toHaveBeenCalledWith("mainnet");
    expect(mainnetButton?.getAttribute("aria-pressed")).toBe("true");
    expect(slotButton?.getAttribute("aria-pressed")).toBe("false");
  });
});
