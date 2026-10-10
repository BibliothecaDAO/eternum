import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const WEI = 10n ** 18n;
/** What the ledger holds for the wallet in each slot: the registration's nine felts, and the slot's cancelled flag. */
const ledger = vi.hoisted(() => ({
  registrations: {} as Record<string, string[]>,
  cancelled: {} as Record<string, boolean>,
  asked: [] as string[],
}));
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
  l2Provider: () => ({
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
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  unmount = () => act(async () => root.unmount());
  return [...owed];
};

it("names the closed slots that still owe the wallet: left unseated at the close, or cancelled, and not yet refunded", async () => {
  ledger.registrations = {
    "1": registration({ refundable: true }),
    "2": registration({ refundable: true, paid: 0n }),
    "3": registration({ gameId: 7 }),
    "4": registration({}),
    "5": registration({ registered: false, paid: 0n }),
    "6": registration({ refundable: true }),
  };
  ledger.cancelled = { "4": true };
  // Slot 6 is still open: its row is already listed, and its entry holds any refund.
  expect(await refundsFor([1, 2, 3, 4, 5].map((id) => slot(id)).concat(slot(6, false)), "0x4a1")).toEqual([
    "slot-1",
    "slot-4",
  ]);
  // One registration read per closed slot; the slot itself only where the wallet registered and was not seated.
  expect(ledger.asked.filter((ask) => ask.startsWith("get_registration")).length).toBe(5);
  expect(ledger.asked.filter((ask) => ask.startsWith("get_slot"))).toEqual(["get_slot:4"]);
});

it("asks the ledger nothing without a payout wallet", async () => {
  expect(await refundsFor([slot(1)], null)).toEqual([]);
  expect(ledger.asked).toEqual([]);
});
