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
  PlayerName: ({ account, you }: { account: string; you: boolean }) => <span>{you ? "You" : account}</span>,
}));
vi.spyOn(console, "error").mockImplementation(() => undefined);

import { BlitzPanel } from "./blitz-rating";

const answered = (self: unknown) => ({
  isError: false,
  isPending: false,
  data: {
    block_number: 1,
    block_hash: "0x1",
    total: 3,
    entries: [
      { rank: 1, player: "0xa", rating: "2480.75" },
      { rank: 2, player: "0xb", rating: "1210" },
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

it("shows the reader's tier and rating, the top rows in whole points, and the reader pinned with a dash before a rank", async () => {
  top.current = answered({ status: "rated", player: "0xc", rating: "1744", rank: null });
  const container = await mount();
  expect(container.textContent).toContain("Conqueror");
  expect(container.textContent).toContain("1,744");
  expect(rows(container)).toEqual(["10xa2,480", "20xb1,210", "—You1,744"]);
});

it("lights the reader's row in place when it ranks among the top", async () => {
  top.current = answered({ status: "rated", player: "0xb", rating: "1210", rank: 2 });
  expect(rows(await mount())).toEqual(["10xa2,480", "2You1,210"]);
});

it("tells a reader with no linked wallet how to carry a rating, never a rating of its own", async () => {
  top.current = answered({ status: "unlinked", player: null, rating: null, rank: null });
  const container = await mount();
  expect(container.textContent).toContain("Link a wallet in Account to carry a rating.");
  expect(rows(container)).toEqual(["10xa2,480", "20xb1,210"]);
});

it("names Ratings when the read fails", async () => {
  top.current = { isError: true, isPending: false, error: new Error("503"), refetch: vi.fn() };
  const container = await mount();
  expect(container.textContent).toContain("Ratings did not answer.");
  expect(container.textContent).not.toContain("503");
});
