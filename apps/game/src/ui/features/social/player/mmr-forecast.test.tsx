// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rankRosterNow, useMmrForecast, type MmrForecast } from "./mmr-forecast";

const ledger = vi.hoisted(() => ({ directory: vi.fn(), rated: vi.fn(), previewMmr: vi.fn() }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({
  useNativeRow: () => ({
    players: [
      { account: 1n, wallet: 0xan },
      { account: 2n, wallet: 0x14n },
    ],
  }),
}));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1", gameId: 3 }) }));
vi.mock("@/runtime/world/directory", () => ({ fetchDirectory: ledger.directory }));
vi.mock("@/shell/value/ledger", () => ({
  environmentLedger: () => ({ rated: ledger.rated, previewMmr: ledger.previewMmr }),
}));

describe("the roster ranked as if the game ended now", () => {
  it("ranks every seat by points in competition ranks, equal points by wallet number, no points as zero", () => {
    const roster = [
      { account: 0x1n, wallet: 0xc0n },
      { account: 0x2n, wallet: 0xa0n },
      { account: 0x3n, wallet: 0xb0n },
      { account: 0x4n, wallet: 0xd0n },
      { account: 0x5n, wallet: 0xe0n },
    ];
    const points = new Map([
      [0x1n, 300],
      [0x2n, 900],
      [0x3n, 300],
      [0x4n, 0],
    ]);

    expect(rankRosterNow(roster, (account) => points.get(account) ?? 0)).toEqual([
      { wallet: "0xa0", rank: 1 },
      { wallet: "0xb0", rank: 2 },
      { wallet: "0xc0", rank: 2 },
      { wallet: "0xd0", rank: 4 },
      { wallet: "0xe0", rank: 4 },
    ]);
  });
});

describe("the MMR forecast's reads", () => {
  const ACCOUNT_1 = `0x${"1".padStart(64, "0")}`;
  const ACCOUNT_2 = `0x${"2".padStart(64, "0")}`;
  const PAID = [{ chainId: "0x1", games: [{ game_id: 3, slotId: 7 }] }];
  let latest: MmrForecast;
  let points: Map<string, { points: number }>;
  let client: QueryClient;
  let root: ReturnType<typeof createRoot> | null = null;

  const Probe = () => {
    latest = useMmrForecast(points);
    return null;
  };
  /** Opens the leaderboard: mounts the hook, and lets every read it starts answer. */
  const open = async () => {
    root ??= createRoot(document.createElement("div"));
    await act(async () =>
      root!.render(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
    await settle();
  };
  const close = async () => {
    await act(async () => root?.unmount());
    root = null;
  };
  const settle = async () => {
    for (let turn = 0; turn < 8; turn++) await act(async () => new Promise((done) => setTimeout(done, 1)));
  };
  const deltas = () => (latest.status === "ready" ? Object.fromEntries(latest.deltaByAccount) : latest.status);

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    points = new Map([
      [ACCOUNT_1, { points: 100 }],
      [ACCOUNT_2, { points: 0 }],
    ]);
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    ledger.rated.mockResolvedValue(true);
    ledger.previewMmr.mockResolvedValue([
      { wallet: "0xa", delta: 26 },
      { wallet: "0x14", delta: -11 },
    ]);
  });
  afterEach(async () => {
    await close();
    client.clear();
  });

  it("keeps a game the directory lists outside any slot off, and asks the ledger nothing", async () => {
    ledger.directory.mockResolvedValue([{ chainId: "0x1", games: [{ game_id: 3, slotId: null }] }]);
    await open();
    expect(latest.status).toBe("off");
    expect(ledger.rated).not.toHaveBeenCalled();
    expect(ledger.previewMmr).not.toHaveBeenCalled();
  });

  it("says unavailable when the directory could not read the game, and reads it again on the next opening", async () => {
    ledger.directory.mockResolvedValue([{ chainId: "0x1", games: null, error: "unavailable" }]);
    await open();
    // The slot read retries once, a second later, before it gives up.
    await act(async () => new Promise((done) => setTimeout(done, 1_200)));
    await settle();
    expect(latest.status).toBe("unavailable");
    expect(ledger.rated).not.toHaveBeenCalled();
    await close();

    ledger.directory.mockResolvedValue(PAID);
    await open();
    expect(ledger.previewMmr).toHaveBeenCalledWith({ shard: "0x1", slotId: 7 }, [
      { wallet: "0xa", rank: 1 },
      { wallet: "0x14", rank: 2 },
    ]);
    expect(deltas()).toEqual({ [ACCOUNT_1]: 26, [ACCOUNT_2]: -11 });
  });

  it("never shows the last ranking's deltas while the new ranking is asked, then shows the new answer by account", async () => {
    ledger.directory.mockResolvedValue(PAID);
    await open();
    expect(deltas()).toEqual({ [ACCOUNT_1]: 26, [ACCOUNT_2]: -11 });

    let answer!: (previews: { wallet: string; delta: number }[]) => void;
    ledger.previewMmr.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    points = new Map([
      [ACCOUNT_1, { points: 0 }],
      [ACCOUNT_2, { points: 100 }],
    ]);
    await open();
    expect(ledger.previewMmr).toHaveBeenLastCalledWith({ shard: "0x1", slotId: 7 }, [
      { wallet: "0x14", rank: 1 },
      { wallet: "0xa", rank: 2 },
    ]);
    expect(latest.status).toBe("waiting");

    await act(async () =>
      answer([
        { wallet: "0x14", delta: 30 },
        { wallet: "0xa", delta: -9 },
      ]),
    );
    await settle();
    expect(deltas()).toEqual({ [ACCOUNT_1]: -9, [ACCOUNT_2]: 30 });
  });

  it("says unavailable when the ledger fails for a new ranking after answering an earlier one", async () => {
    ledger.directory.mockResolvedValue(PAID);
    await open();
    expect(latest.status).toBe("ready");

    ledger.previewMmr.mockRejectedValue(new Error("rpc down"));
    points = new Map([
      [ACCOUNT_1, { points: 0 }],
      [ACCOUNT_2, { points: 100 }],
    ]);
    await open();
    expect(latest.status).toBe("unavailable");
  });
});
