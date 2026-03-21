import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FactoryV2DeveloperConfig } from "./factory-v2-developer-config";

const mocks = vi.hoisted(() => ({
  connector: { controller: { switchStarknetChain: vi.fn(), openSettings: vi.fn(), rpcUrl: vi.fn() } },
  account: {
    execute: vi.fn(),
    waitForTransaction: vi.fn(),
  },
  useAccount: vi.fn(),
  useAccountStore: vi.fn(),
  loadFactoryConfigManifest: vi.fn(),
  resolveFactoryAddress: vi.fn(),
  resolveFactoryConfigDefaultVersion: vi.fn(),
  getFactoryExplorerTxUrl: vi.fn(),
  resolveConnectedTxChainFromRuntime: vi.fn(),
  switchWalletToChain: vi.fn(),
  extractTransactionHash: vi.fn(),
  waitForTransactionConfirmation: vi.fn(),
}));

vi.mock("@/ui/design-system/atoms/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("../mode-appearance", () => ({
  resolveFactoryModeAppearance: vi.fn(() => ({
    featureSurfaceClassName: "",
    quietSurfaceClassName: "",
    primaryButtonClassName: "",
    secondaryButtonClassName: "",
    listItemClassName: "",
  })),
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: mocks.useAccount,
}));

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: mocks.useAccountStore,
}));

vi.mock("@/ui/features/factory/shared/factory-metadata", () => ({
  DEFAULT_FACTORY_NAMESPACE: "s1_eternum",
  loadFactoryConfigManifest: mocks.loadFactoryConfigManifest,
  resolveFactoryAddress: mocks.resolveFactoryAddress,
  resolveFactoryConfigDefaultVersion: mocks.resolveFactoryConfigDefaultVersion,
  getFactoryExplorerTxUrl: mocks.getFactoryExplorerTxUrl,
}));

vi.mock("@/ui/utils/transactions", () => ({
  extractTransactionHash: mocks.extractTransactionHash,
  waitForTransactionConfirmation: mocks.waitForTransactionConfirmation,
}));

vi.mock("@/ui/utils/network-switch", () => ({
  getChainLabel: (chain: string) => (chain === "mainnet" ? "Mainnet" : "Slot"),
  resolveConnectedTxChainFromRuntime: mocks.resolveConnectedTxChainFromRuntime,
  switchWalletToChain: mocks.switchWalletToChain,
}));

vi.mock("@/ui/components/switch-network-prompt", () => ({
  SwitchNetworkPrompt: ({
    open,
    title = "Switch Network Required",
    description,
    switchLabel,
    onClose,
    onSwitch,
  }: {
    open: boolean;
    title?: string;
    description: string;
    switchLabel: string;
    onClose: () => void;
    onSwitch: () => void | Promise<void>;
  }) =>
    open ? (
      <div data-testid="switch-network-prompt">
        <span>{title}</span>
        <span>{description}</span>
        <button onClick={onClose}>Cancel</button>
        <button onClick={() => void onSwitch()}>{switchLabel}</button>
      </div>
    ) : null,
}));

const TEST_MANIFEST = {
  world: { class_hash: "0xworld" },
  contracts: [{ class_hash: "0xcontract", tag: "s1_eternum-prize_distribution_systems", selector: "0xselector" }],
  models: [{ class_hash: "0xmodel" }],
  events: [{ class_hash: "0xevent" }],
  libraries: [{ class_hash: "0xlibrary", tag: "s1_eternum-utility_v1", version: "1" }],
};

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

function updateTextInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("FactoryV2DeveloperConfig", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    mocks.account.execute.mockReset();
    mocks.account.waitForTransaction.mockReset();
    mocks.useAccount.mockReset();
    mocks.useAccountStore.mockReset();
    mocks.loadFactoryConfigManifest.mockReset();
    mocks.resolveFactoryAddress.mockReset();
    mocks.resolveFactoryConfigDefaultVersion.mockReset();
    mocks.getFactoryExplorerTxUrl.mockReset();
    mocks.resolveConnectedTxChainFromRuntime.mockReset();
    mocks.switchWalletToChain.mockReset();
    mocks.extractTransactionHash.mockReset();
    mocks.waitForTransactionConfirmation.mockReset();

    mocks.useAccount.mockReturnValue({
      chainId: "0xslot",
      connector: mocks.connector,
    });
    mocks.useAccountStore.mockImplementation((selector: (state: { account: typeof mocks.account }) => unknown) =>
      selector({ account: mocks.account }),
    );
    mocks.loadFactoryConfigManifest.mockResolvedValue(TEST_MANIFEST);
    mocks.resolveFactoryAddress.mockImplementation((chain: string) => (chain === "mainnet" ? "0xmain" : "0xfactory"));
    mocks.resolveFactoryConfigDefaultVersion.mockImplementation((mode: string) => (mode === "eternum" ? "280" : "180"));
    mocks.getFactoryExplorerTxUrl.mockImplementation(
      (chain: string, txHash: string) => `https://explorer/${chain}/${txHash}`,
    );
    mocks.resolveConnectedTxChainFromRuntime.mockReturnValue("slot");
    mocks.switchWalletToChain.mockResolvedValue(true);
    mocks.extractTransactionHash.mockImplementation(
      (result: { transaction_hash?: string }) => result.transaction_hash ?? null,
    );
    mocks.waitForTransactionConfirmation.mockResolvedValue(undefined);

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

  async function renderDeveloperConfig(props?: { mode?: "blitz" | "eternum"; chain?: "slot" | "mainnet" }) {
    await act(async () => {
      root.render(
        <FactoryV2DeveloperConfig
          mode={props?.mode ?? "blitz"}
          chain={props?.chain ?? "slot"}
          environmentLabel={props?.chain === "mainnet" ? "Mainnet" : "Slot"}
        />,
      );
      await waitForAsyncWork();
    });
  }

  function listSelectedSectionButtons() {
    return Array.from(container.querySelectorAll('button[aria-pressed="true"]'));
  }

  function findButton(label: string) {
    return Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes(label)) as
      | HTMLButtonElement
      | undefined;
  }

  it("selects all factory setter cards by default", async () => {
    await renderDeveloperConfig();

    expect(listSelectedSectionButtons()).toHaveLength(5);
    expect(container.textContent).toContain("5 selected");
  });

  it("can clear and restore the multicall selection", async () => {
    await renderDeveloperConfig();

    const clearAllButton = findButton("Clear all") as HTMLButtonElement;
    const selectAllButton = findButton("Select all") as HTMLButtonElement;
    const sendButton = findButton("Send multicall") as HTMLButtonElement;

    await act(async () => {
      clearAllButton.click();
      await waitForAsyncWork();
    });

    expect(listSelectedSectionButtons()).toHaveLength(0);
    expect(sendButton.disabled).toBe(true);

    await act(async () => {
      selectAllButton.click();
      await waitForAsyncWork();
    });

    expect(listSelectedSectionButtons()).toHaveLength(5);
    expect(sendButton.disabled).toBe(false);
  });

  it("sends one wallet multicall in the fixed setter order", async () => {
    mocks.account.execute.mockResolvedValue({ transaction_hash: "0xtx" });

    await renderDeveloperConfig();

    const sendButton = findButton("Send multicall") as HTMLButtonElement;

    await act(async () => {
      sendButton.click();
      await waitForAsyncWork();
    });

    expect(mocks.account.execute).toHaveBeenCalledTimes(1);
    expect(mocks.waitForTransactionConfirmation).toHaveBeenCalledWith({
      txHash: "0xtx",
      account: mocks.account,
      label: "factory config multicall",
    });

    const calls = mocks.account.execute.mock.calls[0][0];
    expect(calls).toHaveLength(5);
    expect(calls.map((call: { entrypoint: string }) => call.entrypoint)).toEqual([
      "set_factory_config",
      "set_factory_config_contracts",
      "set_factory_config_models",
      "set_factory_config_events",
      "set_factory_config_libraries",
    ]);
    expect(container.textContent).toContain("Multicall confirmed");
    expect(container.querySelector('a[href="https://explorer/slot/0xtx"]')).not.toBeNull();
  });

  it("shows the transaction hash immediately after submission while confirmation is still pending", async () => {
    let resolveConfirmation: (() => void) | null = null;

    mocks.account.execute.mockResolvedValue({ transaction_hash: "0xpending" });
    mocks.waitForTransactionConfirmation.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirmation = resolve;
        }),
    );

    await renderDeveloperConfig();

    const sendButton = findButton("Send multicall") as HTMLButtonElement;

    await act(async () => {
      sendButton.click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Multicall submitted");
    expect(container.textContent).toContain("0xpending");
    expect(sendButton.disabled).toBe(false);

    await act(async () => {
      resolveConfirmation?.();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Multicall confirmed");
  });

  it("shows the custom version warning and regenerates calldata with the edited version", async () => {
    mocks.account.execute.mockResolvedValue({ transaction_hash: "0xversioned" });

    await renderDeveloperConfig();

    const versionInput = container.querySelector("input:not([readonly])") as HTMLInputElement;
    await act(async () => {
      updateTextInputValue(versionInput, "181");
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("This version differs from the default for blitz");

    const sendButton = findButton("Send multicall") as HTMLButtonElement;
    await act(async () => {
      sendButton.click();
      await waitForAsyncWork();
    });

    const calls = mocks.account.execute.mock.calls[0][0];
    expect(calls[0].calldata[0]).toBe("181");
    expect(calls[1].calldata[0]).toBe("181");
  });

  it("shows execution errors from the multicall", async () => {
    mocks.account.execute.mockRejectedValue(new Error("wallet rejected"));

    await renderDeveloperConfig();

    const sendButton = findButton("Send multicall") as HTMLButtonElement;
    await act(async () => {
      sendButton.click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("wallet rejected");
  });

  it("shows the switch network prompt instead of sending when the wallet is on the wrong chain", async () => {
    mocks.resolveConnectedTxChainFromRuntime.mockReturnValue("mainnet");

    await renderDeveloperConfig({ chain: "slot" });

    const sendButton = findButton("Send multicall") as HTMLButtonElement;
    await act(async () => {
      sendButton.click();
      await waitForAsyncWork();
    });

    expect(mocks.account.execute).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Switch Network Required");
    expect(container.textContent).toContain("Your wallet is connected to another chain for this factory action.");

    const switchButton = findButton("Switch To Slot") as HTMLButtonElement;
    await act(async () => {
      switchButton.click();
      await waitForAsyncWork();
    });

    expect(mocks.switchWalletToChain).toHaveBeenCalledWith({
      controller: mocks.connector.controller,
      targetChain: "slot",
    });
  });

  it("resets selection and version when mode or environment changes", async () => {
    await renderDeveloperConfig();

    const clearAllButton = findButton("Clear all") as HTMLButtonElement;
    await act(async () => {
      clearAllButton.click();
      await waitForAsyncWork();
    });

    expect(listSelectedSectionButtons()).toHaveLength(0);

    await renderDeveloperConfig({ mode: "eternum", chain: "mainnet" });

    expect(listSelectedSectionButtons()).toHaveLength(5);
    expect((container.querySelector("input:not([readonly])") as HTMLInputElement).value).toBe("280");
    expect(container.textContent).toContain("Mainnet · mainnet");
  });
});
