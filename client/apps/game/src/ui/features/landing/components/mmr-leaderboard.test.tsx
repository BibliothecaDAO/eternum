import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { useWorldsAvailability } from "@/hooks/use-world-availability";
import { MMRLeaderboard } from "./mmr-leaderboard";

vi.mock("@/hooks/use-factory-worlds", () => ({
  useFactoryWorlds: vi.fn(),
}));

vi.mock("@/hooks/use-world-availability", () => ({
  useWorldsAvailability: vi.fn(),
}));

vi.mock("@/ui/utils/utils", () => ({
  displayAddress: vi.fn((address: string) => address),
}));

vi.mock("starknet", () => ({
  hash: {
    getSelectorFromName: vi.fn(() => "0x1"),
  },
}));

const mockedUseFactoryWorlds = vi.mocked(useFactoryWorlds);
const mockedUseWorldsAvailability = vi.mocked(useWorldsAvailability);

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

describe("MMRLeaderboard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    mockedUseFactoryWorlds.mockReturnValue({
      worlds: [{ name: "demo-world" }],
      isLoading: false,
    } as ReturnType<typeof useFactoryWorlds>);

    mockedUseWorldsAvailability.mockReturnValue({
      results: new Map([["mainnet:demo-world", { meta: { mmrEnabled: true } }]]),
      isAnyLoading: false,
    } as ReturnType<typeof useWorldsAvailability>);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/torii/sql?query=")) {
        const query = decodeURIComponent(url.split("query=")[1] ?? "");

        if (query.includes("WorldConfig")) {
          return createJsonResponse([{ mmr_token_address: "0x1" }]);
        }

        if (query.includes("BlitzRealmPlayerRegister")) {
          return createJsonResponse([{ player: "0x123", name: "0x616c696365", registered_points: "0x2" }]);
        }
      }

      if (url.includes("/katana")) {
        return createJsonResponse([{ id: 0, result: ["0x64", "0x0"] }]);
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
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

  it("re-fetches leaderboard data on an interval without manual refresh", async () => {
    await act(async () => {
      root.render(<MMRLeaderboard />);
      await waitForAsyncWork();
    });

    await act(async () => {
      await waitForAsyncWork();
    });

    const fetchMock = vi.mocked(fetch);
    const worldButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "demo-world",
    );
    expect(worldButton).toBeDefined();

    await act(async () => {
      worldButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    });

    const initialFetchCallCount = fetchMock.mock.calls.length;
    expect(initialFetchCallCount).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
      await waitForAsyncWork();
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(initialFetchCallCount);
  });
});
