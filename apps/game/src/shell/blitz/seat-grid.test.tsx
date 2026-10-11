import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-player-profile", () => ({ usePlayerProfile: () => ({ name: null, portrait: null }) }));
vi.mock("@/ui/design-system/kit/player-name", () => ({
  PlayerName: ({ account }: { account: string }) => <span>{account}</span>,
}));

import type { Seat } from "./lobby";
import { RosterGrid } from "./seat-grid";

afterEach(() => vi.unstubAllGlobals());

const seat = (account: string | null, wallet: string | null): Seat => ({ account, wallet, own: false, prepared: true });

it("shows each seat's rating by the wallet the roster froze for it, and a dash for a seat with none", async () => {
  const fetch = vi.fn<(input: string | URL) => Promise<Response>>(async () =>
    Response.json({
      block_number: 7,
      block_hash: "0x7",
      ratings: { "0xe1": { status: "rated", player: "0xe1", rating: "2410.9" } },
    }),
  );
  vi.stubGlobal("fetch", fetch);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RosterGrid
          seats={[seat("0xa1", "0xe1"), seat("0xa2", "0xe2"), seat(null, null)]}
          total={3}
          preparing={false}
        />
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  // The seats' wallets are asked for, never their accounts; the unnamed seat asks for nothing.
  expect(String(fetch.mock.calls[0][0])).toBe("/api/ratings?players=0xe1,0xe2");
  const seats = [...container.querySelectorAll("li")].map((item) => item.textContent);
  // The unnamed seat is three dashes: its portrait, its name and its rating.
  expect(seats).toEqual(["0xa12,410", "0xa2—", "———"]);
  await act(async () => root.unmount());
});
