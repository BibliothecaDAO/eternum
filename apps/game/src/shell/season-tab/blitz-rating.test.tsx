import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const top = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../ratings", async (actual) => ({
  ...(await actual<typeof import("../ratings")>()),
  useRatingTop: () => top.current,
}));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ session: { user: { realmsId: "0x1" } } }),
}));
vi.mock("@/ui/design-system/kit/player-name", () => ({
  // The kit's name rule, as far as these rows need it: You, a name the host handed it, or a lookup by account.
  PlayerName: ({ account, you, profile }: { account: string; you: boolean; profile?: { name: string | null } }) => (
    <span>{you ? "You" : (profile?.name ?? `lookup ${account}`)}</span>
  ),
}));
vi.spyOn(console, "error").mockImplementation(() => undefined);

import { BlitzPanel } from "./blitz-rating";

const UNLINKED_WALLET = "0x05b1c6e9a0d3f2e4b7c8d9a1e2f3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1";
const UNNAMED_WALLET = "0x0c22d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a877cc";
const TOP_ROWS = ["1Ysabeau2,480", "20x05b1…f0a11,210", "30x0c22…77cc1,100"];

const answered = (self: unknown) => ({
  isError: false,
  isPending: false,
  data: {
    block_number: 1,
    block_hash: "0x1",
    total: 3,
    // As /api/ratings/top answers since fae7dbea5fe: each row's owner with the Realms profile behind it, or null.
    entries: [
      { rank: 1, player: "0xa", rating: "2480.75", profile: { realmsId: "0x10", name: "Ysabeau", portrait: "01" } },
      { rank: 2, player: UNLINKED_WALLET, rating: "1210", profile: null },
      { rank: 3, player: UNNAMED_WALLET, rating: "1100", profile: { realmsId: "0x11", name: null, portrait: null } },
    ],
    self,
  },
});

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
});

const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <BlitzPanel games={null} />
      </MemoryRouter>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return container;
};

const rows = (container: HTMLElement) => [...container.querySelectorAll("li")].map((row) => row.textContent);

it("names each row by its owner's profile, an owner with no Realms name as the wallet's short address, never a lookup", async () => {
  top.current = answered(null);
  const container = await mount();
  expect(rows(container)).toEqual(TOP_ROWS);
  expect(container.textContent).not.toContain("lookup");
});

it("shows the reader's tier and rating, the top rows in whole points, and the reader pinned with a dash before a rank", async () => {
  top.current = answered({ status: "rated", player: "0xc", rating: "1744", rank: null, profile: null });
  const container = await mount();
  expect(container.textContent).toContain("Conqueror");
  expect(container.textContent).toContain("1,744");
  expect(rows(container)).toEqual([...TOP_ROWS, "—You1,744"]);
});

it("lights the reader's row in place when it ranks among the top", async () => {
  top.current = answered({ status: "rated", player: UNLINKED_WALLET, rating: "1210", rank: 2, profile: null });
  expect(rows(await mount())).toEqual([TOP_ROWS[0], "2You1,210", TOP_ROWS[2]]);
});

it("tells a reader with no linked wallet how to carry a rating, never a rating of its own", async () => {
  top.current = answered({ status: "unlinked", player: null, rating: null, rank: null });
  const container = await mount();
  expect(container.textContent).toContain("Link a wallet in Account to carry a rating.");
  expect(rows(container)).toEqual(TOP_ROWS);
});

it("names Ratings when the read fails", async () => {
  top.current = { isError: true, isPending: false, error: new Error("503"), refetch: vi.fn() };
  const container = await mount();
  expect(container.textContent).toContain("Ratings did not answer.");
  expect(container.textContent).not.toContain("503");
});
