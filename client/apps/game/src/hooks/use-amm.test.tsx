import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAmm } from "./use-amm";

vi.mock("@starknet-react/core", () => ({
  useAccount: vi.fn(() => ({ account: null })),
}));

vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_AMM_ADDRESS: "0xaaa",
    VITE_PUBLIC_AMM_LORDS_ADDRESS: "0xbbb",
    VITE_PUBLIC_AMM_INDEXER_URL: "https://amm.example",
  },
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
    expect(latestAmm?.client?.lordsAddress).toBe("0xbbb");
    expect(latestAmm?.client?.api).toBeDefined();
  });
});
