import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LEDGER_PRESET_FIELD_COUNT } from "@realms-world/value-ledger/codecs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const WEI = 10n ** 18n;
/** What the ledger answers a get_slot with: nothing held yet, the slot, or no answer at all. */
const ledger = vi.hoisted(() => ({ slot: "absent" as "absent" | "held" | "down", slotReads: 0 }));
// Slot: season_id, exists, preset_id, close, end, pool (2), registered_count, cancelled.
const SLOT_FELTS = { absent: ["0", "0", "0", "0", "0", "0", "0", "0", "0"], held: SLOT() };
function SLOT() {
  return ["3", "1", "9", String(Math.floor(Date.now() / 1000) + 3600), "0", "0", "0", "31", "0"];
}
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
  l2Provider: () => ({
    callContract: async ({ entrypoint }: { entrypoint: string }) => {
      if (entrypoint === "get_slot") {
        ledger.slotReads += 1;
        if (ledger.slot === "down") throw new Error("503 from the RPC");
        return SLOT_FELTS[ledger.slot];
      }
      if (entrypoint === "lords") return ["0x10e5"];
      if (entrypoint === "get_credits") return ["0", "0"];
      if (entrypoint === "get_registration") return ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
      if (entrypoint === "balance_of") return [String(2_140n * WEI), "0"];
      // Preset: the seat at 500 LORDS (2), cut, chest share, paid fraction, decay, sword (2), shield (2), the rest.
      const price = String(500n * WEI);
      return [
        price,
        "0",
        "1000",
        "1000",
        "2500",
        "8000",
        price,
        "0",
        price,
        "0",
        ...Array<string>(LEDGER_PRESET_FIELD_COUNT - 10).fill("0"),
      ];
    },
  }),
}));

import type { PlaytestSlot } from "../blitz-slot";
import { type EnvironmentLedger, environmentLedger } from "../value/ledger";
import { useSlotRegistered } from "./entry";
import { PaidEntry } from "./entry-panel";

const SLOT_ROW: PlaytestSlot = {
  slotId: 7,
  chainId: "0x52",
  name: "blitz-7",
  closesAt: new Date(Date.now() + 3_600_000).toISOString(),
  frozenAt: "x",
  closed: false,
};

const Registered = () => <output data-registered>{String(useSlotRegistered(SLOT_ROW))}</output>;

let unmount: (() => Promise<void>) | null = null;

/** The slot's lobby as its entry and its count read it: the ledger's own answers, never seeded. */
const openLobby = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PaidEntry
            ledger={environmentLedger() as EnvironmentLedger}
            slot={{ shard: "0x52", slotId: 7 }}
            owner="0x4a1"
            game={undefined}
          />
          <Registered />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
    client.clear();
  };
  return container;
};

const pass = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const wordsOf = (panel: HTMLElement) => [...panel.querySelectorAll("button")].map((button) => button.textContent);

beforeEach(() => {
  vi.useFakeTimers();
  ledger.slot = "absent";
  ledger.slotReads = 0;
});
afterEach(async () => {
  await unmount?.();
  unmount = null;
  vi.useRealTimers();
});

it("says a listed slot the ledger does not hold yet is opening, and reads again by itself until it is there", async () => {
  const lobby = await openLobby();
  await pass(0);
  expect(lobby.textContent).toContain("Entry opens in a moment");
  // Nothing failed: no failure line, no button to press, and nobody is registered in a slot that is not there yet.
  expect(lobby.textContent).not.toContain("did not answer");
  expect(wordsOf(lobby)).toEqual([]);
  expect(lobby.querySelector("[data-registered]")!.textContent).toBe("0");

  const asked = ledger.slotReads;
  await pass(4_000);
  expect(ledger.slotReads).toBeGreaterThan(asked);
  expect(lobby.textContent).toContain("Entry opens in a moment");

  // The ledger records the slot: the next read, a few seconds on and unasked, opens the entry.
  ledger.slot = "held";
  await pass(5_000);
  expect(lobby.textContent).not.toContain("Entry opens in a moment");
  expect(wordsOf(lobby)).toContain("Pay & join");
  expect(lobby.querySelector("[data-registered]")!.textContent).toBe("31");
});

it("keeps the failure line, with Try again, for a ledger that did not answer", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  ledger.slot = "down";
  const lobby = await openLobby();
  await pass(0);
  expect(lobby.textContent).toContain("The ledger did not answer.");
  expect(lobby.textContent).not.toContain("Entry opens in a moment");
  expect(wordsOf(lobby)).toEqual(["Try again"]);
  // The count is unknown, not none.
  expect(lobby.querySelector("[data-registered]")!.textContent).toBe("undefined");

  ledger.slot = "held";
  await act(async () => lobby.querySelector("button")!.click());
  await pass(0);
  expect(wordsOf(lobby)).toContain("Pay & join");
});
