import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FactoryV2DeployerWalletCard } from "./factory-v2-deployer-wallet-card";
import { useFactoryV2DeployerWallet } from "../hooks/use-factory-v2-deployer-wallet";

vi.mock("@/ui/utils/utils", () => ({
  displayAddress: (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`,
}));

vi.mock("../hooks/use-factory-v2-deployer-wallet", () => ({
  useFactoryV2DeployerWallet: vi.fn(),
}));

const buildWalletState = (overrides: Record<string, unknown> = {}) => ({
  address: "0x023003676EF4A5E8f32f5c8714f83fc6bfbefD44C0461a8b7Be16d05b8Ea1532",
  balances: [
    {
      symbol: "STRK",
      displayBalance: "125.2500",
      isLoading: false,
      error: null,
    },
    {
      symbol: "LORDS",
      displayBalance: "42.0000",
      isLoading: false,
      error: null,
    },
  ],
  copyAddress: vi.fn(async () => undefined),
  copyState: "idle",
  isRefreshing: false,
  refreshBalances: vi.fn(async () => undefined),
  ...overrides,
});

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("FactoryV2DeployerWalletCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it("shows the selected chain deployer address with STRK and LORDS balances", async () => {
    vi.mocked(useFactoryV2DeployerWallet).mockReturnValue(
      buildWalletState() as unknown as ReturnType<typeof useFactoryV2DeployerWallet>,
    );

    await act(async () => {
      root.render(<FactoryV2DeployerWalletCard chain="mainnet" environmentLabel="Mainnet" />);
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Deployer wallet");
    expect(container.textContent).toContain("Mainnet deployer");
    expect(container.textContent).toContain("0x023003676EF4A5E8f32f5c8714f83fc6bfbefD44C0461a8b7Be16d05b8Ea1532");
    expect(container.textContent).toContain("STRK");
    expect(container.textContent).toContain("125.2500");
    expect(container.textContent).toContain("LORDS");
    expect(container.textContent).toContain("42.0000");
    expect(container.textContent).toContain("Copy");
    expect(container.textContent).toContain("Refresh");
  });
});
