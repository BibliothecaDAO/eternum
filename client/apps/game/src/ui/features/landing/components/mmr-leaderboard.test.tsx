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

vi.mock("@/hooks/use-player-avatar", () => ({
  useAvatarProfiles: vi.fn(() => ({ data: [] })),
  normalizeAvatarAddress: vi.fn((address: string | null | undefined) => (address ? address.toLowerCase() : null)),
  getAvatarUrl: vi.fn((address: string, customAvatarUrl?: string | null) => customAvatarUrl ?? `/avatar/${address}`),
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

const EVENT_CONTRACT_EXPR =
  "lower(substr(substr(id, instr(id, ':') + 1), instr(substr(id, instr(id, ':') + 1), ':') + 1, instr(substr(substr(id, instr(id, ':') + 1), instr(substr(id, instr(id, ':') + 1), ':') + 1), ':') - 1))";

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

      if (url.includes("blitz-mainnet-global-1")) {
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

  it("defaults to mainnet and allows switching to slot", async () => {
    await act(async () => {
      root.render(<MMRLeaderboard />);
      await waitForAsyncWork();
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const slotButton = buttons.find((button) => button.textContent?.toLowerCase().includes("slot"));
    const mainnetButton = buttons.find((button) => button.textContent?.toLowerCase().includes("mainnet"));

    expect(slotButton).toBeDefined();
    expect(mainnetButton).toBeDefined();
    expect(mainnetButton?.textContent?.toLowerCase()).not.toContain("coming soon");
    expect((mainnetButton as HTMLButtonElement).disabled).toBe(false);

    const fetchMock = vi.mocked(fetch);
    const fetchedUrls = fetchMock.mock.calls.map(([input]) => (typeof input === "string" ? input : input.toString()));

    expect(fetchedUrls.some((url) => url.includes("blitz-mainnet-global-1"))).toBe(true);
    expect(fetchedUrls.some((url) => url.includes("blitz-slot-global-1"))).toBe(false);

    const mainnetUrl = fetchedUrls.find((url) => url.includes("blitz-mainnet-global-1"));
    expect(mainnetUrl).toBeDefined();

    const mainnetQuery = new URL(mainnetUrl ?? "").searchParams.get("query") ?? "";
    const mainnetToken = (MMR_TOKEN_BY_CHAIN.mainnet ?? "").toLowerCase();

    expect(mainnetToken.length).toBeGreaterThan(0);
    expect(mainnetQuery.toLowerCase()).toContain(
      "ltrim(substr(lower(keys), 1, instr(lower(keys), '/') - 1), '0x') = ltrim('0xselector', '0x')",
    );
    expect(mainnetQuery.toLowerCase()).toContain(`${EVENT_CONTRACT_EXPR} = '${mainnetToken}'`);

    await act(async () => {
      (slotButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      const urls = vi.mocked(fetch).mock.calls.map(([input]) => (typeof input === "string" ? input : input.toString()));
      expect(urls.some((url) => url.includes("blitz-slot-global-1"))).toBe(true);
    });

    const fetchedUrlsAfterSwitch = vi
      .mocked(fetch)
      .mock.calls.map(([input]) => (typeof input === "string" ? input : input.toString()));
    const slotUrl = fetchedUrlsAfterSwitch.find((url) => url.includes("blitz-slot-global-1"));
    expect(slotUrl).toBeDefined();

    const slotQuery = new URL(slotUrl ?? "").searchParams.get("query") ?? "";
    const slotToken = (MMR_TOKEN_BY_CHAIN.slot ?? "").toLowerCase();

    expect(slotToken.length).toBeGreaterThan(0);
    expect(slotQuery.toLowerCase()).toContain(`${EVENT_CONTRACT_EXPR} = '${slotToken}'`);
  });

  it("shows the MMR tier column on landing entries", async () => {
    await act(async () => {
      root.render(<MMRLeaderboard />);
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Tier");
      expect(container.textContent).toContain("Iron");
    });
  });

  it("renders player avatars in leaderboard rows", async () => {
    await act(async () => {
      root.render(<MMRLeaderboard />);
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(container.querySelector("tbody img")).not.toBeNull();
    });

    const avatarImage = container.querySelector("tbody img") as HTMLImageElement;
    expect(avatarImage.getAttribute("src")).toContain("/avatar/0x123");
    expect(avatarImage.getAttribute("alt")).toContain("avatar");
  });
});
