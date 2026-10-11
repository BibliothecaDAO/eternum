import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const WEI = 10n ** 18n;
/**
 * What the ledger holds for the wallet: the slots its Registered events name (served two to a page), each slot's
 * registration as nine felts, and the slots' cancelled flags.
 */
const ledger = vi.hoisted(() => ({
  registered: [] as string[],
  registrations: {} as Record<string, string[]>,
  cancelled: {} as Record<string, boolean>,
  asked: [] as string[],
  eventKeys: [] as unknown[],
}));
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
  l2Provider: () => ({
    getEvents: async ({ keys, continuation_token }: { keys: unknown[]; continuation_token?: string }) => {
      ledger.asked.push("get_events");
      ledger.eventKeys = keys;
      const from = Number(continuation_token ?? 0);
      return {
        events: ledger.registered.slice(from, from + 2).map((slotId) => ({ keys: ["0x0", "0x52", slotId, "0x4a1"] })),
        continuation_token: from + 2 < ledger.registered.length ? String(from + 2) : undefined,
      };
    },
    callContract: async ({ entrypoint, calldata }: { entrypoint: string; calldata: string[] }) => {
      ledger.asked.push(`${entrypoint}:${calldata[1]}`);
      if (entrypoint === "get_registration") return ledger.registrations[calldata[1]];
      return ["3", "1", "9", "100", "200", "0", "0", "31", ledger.cancelled[calldata[1]] ? "1" : "0"];
    },
  }),
}));

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { useRefundSlots } from "./entry";

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
});

const refundsFor = async (slots: PlaytestSlot[], wallet: string | null) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let owed: ReadonlySet<string> = new Set();
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
  // The wallet's registrations answer first (page by page), then each registration, then a slot or two.
  for (let turn = 0; turn < 6; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  unmount = () => act(async () => root.unmount());
  return [...owed];
};

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
