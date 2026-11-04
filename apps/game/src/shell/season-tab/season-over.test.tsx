import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

/** What the HUD's season-over reads, at its edges: the game, the board, the viewer and their home. */
const facts = vi.hoisted(() => ({
  presetId: 6,
  viewer: null as string | null,
  home: null as unknown,
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => 0 }));
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));
vi.mock("@/runtime/world", async (importOriginal) => {
  const { ARCHIVED_SEASONS } = await import("./archive/archive");
  return {
    ...(await importOriginal<typeof import("@/runtime/world")>()),
    getActiveGame: () => ({ chainId: ARCHIVED_SEASONS[0]!.chainId }),
  };
});
vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const original = await importOriginal<typeof import("@bibliothecadao/eternum")>();
  const { ARCHIVED_SEASONS } = await import("./archive/archive");
  return {
    ...original,
    configManager: { isGameOver: () => true, getActiveGameId: () => ARCHIVED_SEASONS[0]!.game_id },
  };
});
vi.mock("@/ui/features/frontier/board/season-board", async () => {
  const { ARCHIVED_SEASONS, archivedSeason } = await import("./archive/archive");
  const board = archivedSeason({ chainId: ARCHIVED_SEASONS[0]!.chainId, gameId: ARCHIVED_SEASONS[0]!.game_id })!.board;
  return {
    useFrontierBoard: (select: (state: { data: typeof board }) => unknown) => select({ data: board }),
    useSeasonViewer: () => facts.viewer,
  };
});
vi.mock("./finished-game", async () => {
  const { ARCHIVED_SEASONS } = await import("./archive/archive");
  return { useFinishedGame: () => ({ ...ARCHIVED_SEASONS[0]!, preset_id: facts.presetId }) };
});
vi.mock("./festival", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./festival")>()),
  useSeasonHome: () => facts.home,
}));
vi.stubGlobal("fetch", () => new Promise<Response>(() => {}));

import { homeIcon } from "@/ui/design-system/home-icons";
import { setViewportWidth } from "../frame/test-viewport";
import { SeasonOver } from "./season-over";

const CANZI = "0x648174392d94df37bc7d59c3abf22116d20df16ddf0e380c5ff79aff86738c4";
const DEVCON_HOME = { kind: "campaign", mark: { line: "Devcon", golden: false, icon: homeIcon("devcon", 1) } };
const GOLDEN_HOME = {
  kind: "campaign",
  mark: { line: "Golden Devcon", golden: true, icon: homeIcon("devcon-golden", 1) },
};

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  Object.assign(facts, { presetId: 6, viewer: null, home: null });
});

/** The season-over as the HUD mounts it, for a reader with this home in this season. */
const open = async ({ presetId = 6, viewer = CANZI as string | null, home = DEVCON_HOME as unknown } = {}) => {
  Object.assign(facts, { presetId, viewer, home });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(1440);
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SeasonOver realm={null} onSeason={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return document.body;
};

const said = (page: Element) => page.textContent?.replace(/\s+/g, " ") ?? "";
const greeting = (page: HTMLElement) => page.querySelector(".festival-cover");
const ticket = (page: HTMLElement) => page.querySelector(".festival-gift")?.textContent?.replace(/\s+/g, " ");

it("greets a Devcon realm's owner first in the Devcon season: thanks, Diwali, their place and ticket", async () => {
  const page = await open();
  expect(greeting(page)).not.toBeNull();
  expect(said(page)).toContain("Thanks for playing");
  expect(said(page)).toContain("Happy Diwali! Go enjoy it with the people you love.");
  expect(page.querySelector(".festival-result")?.textContent).toBe("#3of 45 realms");
  expect(ticket(page)).toBe(
    "For Devcon realm owners" +
      "You get a special Season 1 ticket" +
      "With a special realm" +
      "Season 1 · Devcon" +
      "It will be on this account. Nothing to do.",
  );
  expect(page.querySelector(".season-recap")).toBeNull();
});

it("promises a golden owner the same special ticket, and names no tier", async () => {
  const page = await open({ home: GOLDEN_HOME });
  expect(ticket(page)).toContain("You get a special Season 1 ticket");
  expect(said(greeting(page)!).toLowerCase()).not.toContain("golden");
});

it("tells a free home's and a held Realm's player they are welcome back, and promises them no ticket", async () => {
  for (const home of [{ kind: "free" }, { kind: "realm", level: 2 }]) {
    const page = await open({ home });
    expect(page.querySelector(".festival-gift")).toBeNull();
    expect(said(greeting(page)!)).toContain("See you in Season 1.");
    await unmount!();
  }
});

it("opens the season's recap from See my season, with its steps to post", async () => {
  const page = await open();
  await act(async () =>
    [...page.querySelectorAll("button")].find((button) => button.textContent === "See my season")!.click(),
  );
  expect(greeting(page)).toBeNull();
  expect(page.querySelector(".season-recap")).not.toBeNull();
  expect(said(page)).toContain("Post on X");
});

it("greets no one in another season, nor a reader with no realm on the board: the recap stands at once", async () => {
  for (const reader of [{ presetId: 0 }, { viewer: null }]) {
    const page = await open(reader);
    expect(greeting(page)).toBeNull();
    expect(page.querySelector(".season-recap")).not.toBeNull();
    await unmount!();
  }
});
