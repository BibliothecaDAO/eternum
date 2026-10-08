import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: { user: { realmsId: "0x7" } } as { user: { realmsId: string } } | null,
  ratings: undefined as unknown,
}));
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ session: state.session }) }));
vi.mock("./ratings", async (actual) => ({
  ...(await actual<typeof import("./ratings")>()),
  useRatings: () => ({ data: state.ratings }),
}));

import { OwnRatingLine } from "./own-rating";

const text = () => renderToStaticMarkup(<OwnRatingLine />).replace(/<[^>]+>/g, "");

afterEach(() => {
  state.session = { user: { realmsId: "0x7" } };
  state.ratings = undefined;
});

it("shows the player's current rating with its tier, never a change", () => {
  state.ratings = { ratings: { "0x7": { status: "rated", player: "0xe", rating: "2410.9" } } };
  expect(text()).toBe("2,410Storm Lord· Blitz rating");
});

it("tells a player with no linked wallet how to carry a rating", () => {
  state.ratings = { ratings: { "0x7": { status: "unlinked", player: null, rating: null } } };
  expect(text()).toBe("Link a wallet in Account to carry a rating.");
});

it("shows a dash while the rating has not answered, and nothing to a signed-out reader", () => {
  expect(text()).toBe("—· Blitz rating");
  state.session = null;
  expect(text()).toBe("");
});
