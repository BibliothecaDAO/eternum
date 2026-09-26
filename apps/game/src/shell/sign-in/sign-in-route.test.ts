import { afterEach, describe, expect, it } from "vitest";

import { parsePlayRoute } from "@/play/navigation/play-route";
import { overrideSpectateIntent, resolveSpectateIntent } from "@/utils/spectator-session";

import { nextOf, returnPathOf, safeNextPath, signInHref } from "./sign-in-route";

const GAME = "/g/0x5245414c4d53/1";

afterEach(() => overrideSpectateIntent(false));

describe("the sign-in flow's return path", () => {
  it("keeps a path on this site, with its query and hash", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath(`${GAME}/hex?col=4&row=9#top`)).toBe(`${GAME}/hex?col=4&row=9#top`);
  });

  it("sends anything that could leave the site, or loop into the flow, home", () => {
    for (const raw of [
      null,
      "",
      "account",
      "https://evil.example/",
      "//evil.example/path",
      "/\\evil.example",
      "/\t/evil.example",
      "javascript:alert(1)",
      "/sign-in?next=/account",
    ]) {
      expect(safeNextPath(raw)).toBe("/");
    }
  });

  it("checks the path when it builds the flow's href and when it reads it back", () => {
    expect(signInHref("//evil.example")).toBe("/sign-in?next=%2F");
    expect(nextOf(`?next=${encodeURIComponent("/results")}`)).toBe("/results");
    expect(nextOf("?next=https://evil.example")).toBe("/");
  });

  it("brings a spectator back to the same game, scene and hex, still spectating", () => {
    resolveSpectateIntent({ search: "?spectate=true" });
    // In-app navigation dropped the flag from the live URL; the session still holds it.
    const back = returnPathOf({ pathname: `${GAME}/map`, search: "?col=12&row=-3" });
    const url = new URL(back, "https://realms.invalid");
    expect(url.searchParams.get("spectate")).toBe("true");
    expect(parsePlayRoute(url)).toMatchObject({ gameId: 1, scene: "map", col: 12, row: -3 });
    expect(nextOf(new URL(signInHref(back), "https://realms.invalid").search)).toBe(back);
  });

  it("returns a player to the shell page they asked from", () => {
    expect(returnPathOf({ pathname: "/results", search: "?game=2" })).toBe("/results?game=2");
    expect(returnPathOf({ pathname: "/sign-in", search: "?next=%2Faccount" })).toBe("/account");
  });
});
