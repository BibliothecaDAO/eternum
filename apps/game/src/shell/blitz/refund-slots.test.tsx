import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const WEI = 10n ** 18n;
/**
 * What the ledger holds for the payout wallet 0x4a1: the slots its Registered events name (served two to a page), each
 * slot's registration as nine felts, and the slots' cancelled flags. `others` holds the same for any other wallet, by
 * its address: the slots it registered in, each left unseated at the close.
 */
const ledger = vi.hoisted(() => ({
  registered: [] as string[],
  registrations: {} as Record<string, string[]>,
  cancelled: {} as Record<string, boolean>,
  others: {} as Record<string, string[]>,
  asked: [] as string[],
  eventKeys: [] as unknown[],
}));
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
  l2Provider: () => ({
    getEvents: async ({ keys, continuation_token }: { keys: string[][]; continuation_token?: string }) => {
      ledger.asked.push("get_events");
      ledger.eventKeys = keys;
      const owner = keys[3][0];
      const registered = owner === "0x4a1" ? ledger.registered : (ledger.others[owner] ?? []);
      const from = Number(continuation_token ?? 0);
      return {
        events: registered.slice(from, from + 2).map((slotId) => ({ keys: ["0x0", "0x52", slotId, owner] })),
        continuation_token: from + 2 < registered.length ? String(from + 2) : undefined,
      };
    },
    callContract: async ({ entrypoint, calldata }: { entrypoint: string; calldata: string[] }) => {
      ledger.asked.push(`${entrypoint}:${calldata[1]}`);
      if (entrypoint === "get_registration")
        return calldata[2] === "0x4a1" ? ledger.registrations[calldata[1]] : UNSEATED;
      return ["3", "1", "9", "100", "200", "0", "0", "31", ledger.cancelled[calldata[1]] ? "1" : "0"];
    },
  }),
}));

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { useRefundSlots } from "./entry";

/** A registration the close left unseated, as nine felts: 500 LORDS paid, refundable, no game. */
const UNSEATED = ["1", "0", "0", "0", "0", String(500n * 10n ** 18n), "0", "1", "0"];

// Registration: registered, sword, shield, sword credit, shield credit, paid (2), refundable, game id.
const registration = (over: { registered?: boolean; paid?: bigint; refundable?: boolean; gameId?: number }) => [
  over.registered === false ? "0" : "1",
  "0",
  "0",
  "0",
  "0",
  String(over.paid ?? 500n * WEI),
  "0",
  over.refundable ? "1" : "0",
  String(over.gameId ?? 0),
];
const slot = (slotId: number, closed = true): PlaytestSlot => ({
  slotId,
  chainId: "0x52",
  name: `slot-${slotId}`,
  closesAt: new Date(0).toISOString(),
  frozenAt: closed ? "x" : null,
  closed,
});

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  ledger.asked = [];
  ledger.others = {};
  vi.unstubAllGlobals();
});

/** A wallet extension in the browser that shares `accounts` with this site; `asked` records what it was asked. */
const browserWallet = (accounts: string[]) => {
  const asked: unknown[] = [];
  vi.stubGlobal("starknet_argentX", {
    request: async (call: unknown) => {
      asked.push(call);
      return accounts;
    },
  });
  return asked;
};

/** The slots owed a refund, each with the wallet it is owed to. */
const owedFor = async (slots: PlaytestSlot[], wallet: string | null) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let owed: ReadonlyMap<string, string> = new Map();
  const Probe = () => {
    owed = useRefundSlots(slots, wallet);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  // The browser's wallets answer first, then a wallet's registrations (page by page), each registration, a slot or two.
  for (let turn = 0; turn < 8; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  unmount = () => act(async () => root.unmount());
  return [...owed];
};

const refundsFor = async (slots: PlaytestSlot[], wallet: string | null) =>
  (await owedFor(slots, wallet)).map(([name]) => name);

it("names the closed slots that still owe the wallet: left unseated at the close, or cancelled, and not yet refunded", async () => {
  ledger.registered = ["0x1", "0x2", "0x3", "0x4", "0x6"];
  ledger.registrations = {
    "1": registration({ refundable: true }),
    "2": registration({ refundable: true, paid: 0n }),
    "3": registration({ gameId: 7 }),
    "4": registration({}),
    "6": registration({ refundable: true }),
  };
  ledger.cancelled = { "4": true };
  // Slot 6 is still open: its row is already listed, and its entry holds any refund.
  expect(await refundsFor([1, 2, 3, 4, 5].map((id) => slot(id)).concat(slot(6, false)), "0x4a1")).toEqual([
    "slot-1",
    "slot-4",
  ]);
  // The slot itself is read only where the wallet registered and was not seated.
  expect(ledger.asked.filter((ask) => ask.startsWith("get_slot"))).toEqual(["get_slot:4"]);
});

it("reads the ledger by the wallet's own registrations, however many closed slots the launch service lists", async () => {
  ledger.registered = ["0x1", "0x2", "0x3"];
  ledger.registrations = {
    "1": registration({ refundable: true }),
    "2": registration({ gameId: 7 }),
    "3": registration({ gameId: 8 }),
  };
  ledger.cancelled = {};
  // A season's worth of closed slots, of which this wallet registered in three.
  const listed = Array.from({ length: 400 }, (_, index) => slot(index + 1));
  expect(await refundsFor(listed, "0x4a1")).toEqual(["slot-1"]);
  // One event query for the wallet (here two pages), filtered by its address in the owner key, any shard and slot.
  expect(ledger.asked.filter((ask) => ask === "get_events").length).toBe(2);
  expect(ledger.eventKeys.slice(1)).toEqual([[], [], ["0x4a1"]]);
  // Then one registration read for each of its three slots, never one per listed slot.
  expect(ledger.asked.filter((ask) => ask.startsWith("get_registration")).length).toBe(3);
  expect(ledger.asked.length).toBe(5);
});

it("asks the ledger nothing without a payout wallet, or with no closed slot listed", async () => {
  expect(await refundsFor([slot(1)], null)).toEqual([]);
  expect(await refundsFor([slot(1, false)], "0x4a1")).toEqual([]);
  expect(ledger.asked).toEqual([]);
});

it("finds a refund owed to a wallet of this browser that is not the payout wallet, asking the browser silently", async () => {
  ledger.registered = ["0x1"];
  ledger.registrations = { "1": registration({ refundable: true }) };
  ledger.cancelled = {};
  ledger.others = { "0xb0b": ["0x1", "0x2"] };
  // The extension also shares the payout wallet itself, which is asked once.
  const asked = browserWallet(["0x4A1", "0xb0b"]);
  // Slot 1 owes both wallets: the payout wallet's refund comes first. Slot 2 owes only the wallet replaced since.
  expect(await owedFor([slot(1), slot(2)], "0x4a1")).toEqual([
    ["slot-1", "0x4a1"],
    ["slot-2", "0xb0b"],
  ]);
  expect(asked).toEqual([{ type: "wallet_requestAccounts", params: { silent_mode: true } }]);
  expect(ledger.asked.filter((ask) => ask === "get_events").length).toBe(2);

  // A player with no payout wallet linked is still shown what this browser's wallet is owed.
  await unmount?.();
  browserWallet(["0xb0b"]);
  expect(await owedFor([slot(1), slot(2)], null)).toEqual([
    ["slot-1", "0xb0b"],
    ["slot-2", "0xb0b"],
  ]);
});

it("asks the browser's wallets nothing while no closed slot is listed", async () => {
  const asked = browserWallet(["0xb0b"]);
  expect(await owedFor([slot(1, false)], "0x4a1")).toEqual([]);
  expect(asked).toEqual([]);
});
