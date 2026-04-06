// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SecondaryMenuItems } from "./secondary-menu-items";

const mocks = vi.hoisted(() => ({
  useDojo: vi.fn(),
  useEntityQuery: vi.fn(),
  has: vi.fn(),
  useAccount: vi.fn(),
  useAccountStore: vi.fn(),
  useConnectionStore: vi.fn(),
  useTransactionStore: vi.fn(),
  useUIStore: vi.fn(),
  useLatestFeaturesSeen: vi.fn(),
  resolveChain: vi.fn(),
  resolveConnectedTxChainFromRuntime: vi.fn(),
  switchWalletToChain: vi.fn(),
}));

vi.mock("@bibliothecadao/react", () => ({
  useDojo: mocks.useDojo,
}));

vi.mock("@dojoengine/react", () => ({
  useEntityQuery: mocks.useEntityQuery,
}));

vi.mock("@dojoengine/recs", () => ({
  Has: mocks.has,
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: mocks.useAccount,
}));

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: mocks.useAccountStore,
}));

vi.mock("@/hooks/store/use-connection-store", () => ({
  useConnectionStore: mocks.useConnectionStore,
}));

vi.mock("@/hooks/store/use-transaction-store", () => ({
  useTransactionStore: mocks.useTransactionStore,
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: mocks.useUIStore,
}));

vi.mock("@/hooks/use-latest-features-seen", () => ({
  useLatestFeaturesSeen: mocks.useLatestFeaturesSeen,
}));

vi.mock("@/runtime/world", () => ({
  resolveChain: mocks.resolveChain,
}));

vi.mock("@/ui/utils/network-switch", () => ({
  getChainLabel: (chain: string) => {
    switch (chain) {
      case "mainnet":
        return "Mainnet";
      case "sepolia":
        return "Sepolia";
      default:
        return "Slot";
    }
  },
  resolveConnectedTxChainFromRuntime: mocks.resolveConnectedTxChainFromRuntime,
  switchWalletToChain: mocks.switchWalletToChain,
}));

vi.mock("@/ui/design-system/molecules/circle-button", () => ({
  default: ({ label, onClick }: { label?: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {label ?? "circle-button"}
    </button>
  ),
}));

vi.mock("@/ui/modules/controller/controller", () => ({
  Controller: () => <div>Controller</div>,
}));

vi.mock("@/ui/shared/components/home-button", () => ({
  HomeButton: () => <div>Home</div>,
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

describe("SecondaryMenuItems network switch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    mocks.useDojo.mockReturnValue({
      setup: {
        components: {
          events: { SeasonEnded: "SeasonEnded" },
        },
      },
    });
    mocks.useEntityQuery.mockReturnValue([]);
    mocks.has.mockImplementation((value: unknown) => value);
    mocks.useAccount.mockReturnValue({
      address: "0xabc",
      chainId: "0xslot",
      connector: { controller },
    });
    mocks.useAccountStore.mockImplementation(
      (selector: (state: { connector: { controller: typeof controller } }) => unknown) =>
        selector({ connector: { controller } }),
    );
    mocks.useConnectionStore.mockImplementation((selector: (state: { status: "connected" }) => unknown) =>
      selector({ status: "connected" }),
    );
    mocks.useTransactionStore.mockImplementation(
      (selector: (state: { transactions: []; stuckThresholdMs: number }) => unknown) =>
        selector({ transactions: [], stuckThresholdMs: 30_000 }),
    );
    mocks.useUIStore.mockImplementation(
      (
        selector: (state: {
          togglePopup: () => void;
          isPopupOpen: () => boolean;
          structureEntityId: string;
        }) => unknown,
      ) =>
        selector({
          togglePopup: () => {},
          isPopupOpen: () => false,
          structureEntityId: "1",
        }),
    );
    mocks.useLatestFeaturesSeen.mockReturnValue({ unseenCount: 0 });
    mocks.resolveChain.mockReturnValue("mainnet");
    mocks.resolveConnectedTxChainFromRuntime.mockReturnValue("slot");
    mocks.switchWalletToChain.mockResolvedValue(true);

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
    controller.switchStarknetChain.mockReset();
    controller.openSettings.mockReset();
    controller.rpcUrl.mockReset();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders a top-right network switch action for the active game chain", async () => {
    await act(async () => {
      root.render(<SecondaryMenuItems />);
      await waitForAsyncWork();
    });

    const switchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Switch to Mainnet"),
    );

    expect(switchButton).toBeDefined();

    await act(async () => {
      switchButton?.click();
      await waitForAsyncWork();
    });

    expect(mocks.switchWalletToChain).toHaveBeenCalledWith({
      controller,
      targetChain: "mainnet",
    });
  });
});
