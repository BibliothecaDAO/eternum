import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import type { PlaytestSlot } from "../blitz-slot";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
/** What the Blitz list found: the closed slots that owe a refund, each with the wallet owed. */
const found = vi.hoisted(() => ({ refunds: new Map<string, string>() }));
// The ledger answers nothing here: only whose entry the lobby opens is under test.
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
  l2Provider: () => ({ callContract: () => new Promise(() => {}) }),
}));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({
    status: "signed-in",
    session: { user: { id: "u", realmsId: "0x7", address: "0x4a1" } },
  }),
}));
vi.mock("../play/play-facts", () => ({
  usePlayFacts: () => ({
    directory: { isSuccess: true },
    slots: { isSuccess: true, data: { slots: SLOTS } },
    now: 1_000,
    games: [],
    finished: [],
    blitz: [],
    refunds: found.refunds,
    signedIn: true,
    step: undefined,
  }),
}));
vi.mock("./entry-panel", () => ({
  PaidEntry: ({ owner }: { owner: string | null }) => <output data-owner>{owner}</output>,
}));
vi.mock("./lobby-chat-panel", () => ({ LobbyChatPanel: () => null }));

import { BlitzLobbyPage } from "./blitz-pages";

const closedSlot = (slotId: number): PlaytestSlot => ({
  slotId,
  chainId: "0x52",
  name: `blitz-${slotId}`,
  closesAt: new Date(0).toISOString(),
  frozenAt: "x",
  closed: true,
});
const SLOTS = [closedSlot(1), closedSlot(2)];

let go: (path: string) => void = () => undefined;
const Navigator = () => {
  go = useNavigate();
  return null;
};

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  found.refunds = new Map();
});

it("keeps the wallet a refund was found for through its refund, and never carries it to another slot's lobby", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  found.refunds = new Map([["blitz-1", "0xb0b"]]);
  const container = document.createElement("div");
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const show = () =>
    act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/blitz/slot-blitz-1"]}>
          <QueryClientProvider client={client}>
            <Navigator />
            <Routes>
              <Route path="/blitz/:id" element={<BlitzLobbyPage />} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    );
  unmount = () => act(async () => root.unmount());
  const owner = () => container.querySelector("[data-owner]")?.textContent;

  // The slot owes a wallet the player has since replaced: its entry is read for that wallet, not the payout wallet.
  await show();
  expect(owner()).toBe("0xb0b");

  // The refund lands and the list no longer finds it: the entry stays on the wallet that took it.
  found.refunds = new Map();
  await show();
  expect(owner()).toBe("0xb0b");

  // Another slot's lobby, on the same page, opens for the payout wallet.
  await act(async () => go("/blitz/slot-blitz-2"));
  expect(owner()).toBe("0x4a1");
});
