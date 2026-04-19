import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAmm } from "./use-amm";

const executeObservedClientTransactionMock = vi.hoisted(() => vi.fn());

vi.mock("@starknet-react/core", () => ({
  useAccount: vi.fn(() => ({ account: null })),
}));

vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_AMM_ROUTER_ADDRESS: "0xaaa",
    VITE_PUBLIC_AMM_LORDS_ADDRESS: "0xbbb",
    VITE_PUBLIC_AMM_INDEXER_URL: "https://amm.example",
  },
}));

vi.mock("@/observability/observed-client-transaction", () => ({
  executeObservedClientTransaction: executeObservedClientTransactionMock,
}));

let latestAmm: ReturnType<typeof useAmm> | null = null;

function HookHarness() {
  latestAmm = useAmm();
  return null;
}

describe("useAmm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestAmm = null;
    executeObservedClientTransactionMock.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("builds the AMM client from environment config instead of placeholders", async () => {
    await act(async () => {
      root.render(<HookHarness />);
    });

    expect(latestAmm?.client?.ammAddress).toBe("0xaaa");
    expect(latestAmm?.client?.routerAddress).toBe("0xaaa");
    expect(latestAmm?.client?.lordsAddress).toBe("0xbbb");
    expect(latestAmm?.client?.api).toBeDefined();
  });

  it("routes swap execution through the observed transaction helper", async () => {
    const account = { address: "0xabc", execute: vi.fn() };
    const { useAccount } = await import("@starknet-react/core");
    vi.mocked(useAccount).mockReturnValue({ account } as never);
    executeObservedClientTransactionMock.mockResolvedValue({ transaction_hash: "0xtx" });

    await act(async () => {
      root.render(<HookHarness />);
    });

    await expect(
      latestAmm?.executeSwap({
        contractAddress: "0xrouter",
        entrypoint: "swap",
        calldata: [],
      }),
    ).resolves.toBe("0xtx");

    expect(executeObservedClientTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        account,
        surface: "amm",
        operation: "amm_execute",
      }),
    );
  });
});
