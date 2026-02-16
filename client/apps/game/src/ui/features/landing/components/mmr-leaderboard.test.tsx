import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MMR_TOKEN_BY_CHAIN } from "@/config/global-chain";
import { MMRLeaderboard } from "./mmr-leaderboard";

vi.mock("@/ui/utils/utils", () => ({
  displayAddress: vi.fn((address: string) => address),
}));

vi.mock("@/ui/features/market/landing-markets/maybe-controller", () => ({
  MaybeController: ({ address, className }: { address: string; className?: string }) => (
    <div className={className}>{address}</div>
  ),
}));

vi.mock("starknet", () => ({
  hash: {
    getSelectorFromName: vi.fn(() => "0xselector"),
  },
}));

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createJsonResponse = (payload: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => payload,
  }) as Response;

const buildRow = (overrides: Record<string, unknown> = {}) => ({
  player_address: "0x123",
  id: "0x1:0x2:0x3:0x0",
  executed_at: "2026-02-12T00:00:00Z",
  old_mmr_low: "0x0",
  old_mmr_high: "0x0",
  new_mmr_low: "0x0",
  new_mmr_high: "0x0",
  event_timestamp: "0x65c8f0f0",
  mmr_rank: 1,
  total_rows: 1,
  ...overrides,
});

describe("MMRLeaderboard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (!url.includes("/sql?query=")) {
        throw new Error(`Unexpected fetch URL: ${url}`);
      }

      if (url.includes("eternum-global-mainnet")) {
        return createJsonResponse([buildRow()]);
      }

      if (url.includes("blitz-slot-global-1")) {
        return createJsonResponse([buildRow({ player_address: "0x456" })]);
      }

      throw new Error(`Unexpected global torii URL: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

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
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("does not re-fetch leaderboard data automatically", async () => {
    await act(async () => {
      root.render(<MMRLeaderboard />);
      await waitForAsyncWork();
    });

    const fetchMock = vi.mocked(fetch);

    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    });

    const initialCallCount = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
      await waitForAsyncWork();
    });

    expect(fetchMock.mock.calls.length).toBe(initialCallCount);
  });

  it("defaults to slot and keeps mainnet disabled as coming soon", async () => {
    await act(async () => {
      root.render(<MMRLeaderboard />);
      await waitForAsyncWork();
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const slotButton = buttons.find((button) => button.textContent?.toLowerCase().includes("slot"));
    const mainnetButton = buttons.find((button) => button.textContent?.toLowerCase().includes("mainnet"));

    expect(slotButton).toBeDefined();
    expect(mainnetButton).toBeDefined();
    expect(mainnetButton?.textContent?.toLowerCase()).toContain("coming soon");
    expect((mainnetButton as HTMLButtonElement).disabled).toBe(true);

    const fetchMock = vi.mocked(fetch);
    const fetchedUrls = fetchMock.mock.calls.map(([input]) => (typeof input === "string" ? input : input.toString()));

    expect(fetchedUrls.some((url) => url.includes("blitz-slot-global-1"))).toBe(true);
    expect(fetchedUrls.some((url) => url.includes("eternum-global-mainnet"))).toBe(false);

    const slotUrl = fetchedUrls.find((url) => url.includes("blitz-slot-global-1"));
    expect(slotUrl).toBeDefined();

    const slotQuery = new URL(slotUrl ?? "").searchParams.get("query") ?? "";
    const slotToken = (MMR_TOKEN_BY_CHAIN.slot ?? "").toLowerCase();

    expect(slotToken.length).toBeGreaterThan(0);
    expect(slotQuery.toLowerCase()).toContain(
      "ltrim(substr(lower(keys), 1, instr(lower(keys), '/') - 1), '0x') = ltrim('0xselector', '0x')",
    );
    expect(slotQuery.toLowerCase()).toContain(
      `lower(id) like '%:${slotToken}:%'`,
    );
  });
});
