import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

/** What the HUD's season-over reads, at its edges: the game, the board, the viewer and their home's CampaignHome row. */
const facts = vi.hoisted(() => ({
  race: false,
  presetId: 6,
  viewer: null as string | null,
  campaignHome: undefined as unknown,
}));
// The web: season-recap.test.tsx plays the recap in each app.
vi.mock("@/runtime/distribution-channel", () => ({ distributionChannel: () => "web" }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => 0 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: { store: { get: (model: string) => (model === "CampaignHome" ? facts.campaignHome : model === "RaceRules" && facts.race ? {} : undefined) } },
  }),
}));
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
    useFrontierBoard: (select: (state: { data: typeof board }) => unknown) => {
      if (facts.race) throw new Error("Race cannot read the sites-cleared board");
      return select({ data: board });
    },
    useSeasonViewer: () => facts.viewer,
  };
});
vi.mock("./finished-game", async () => {
  const { ARCHIVED_SEASONS } = await import("./archive/archive");
  return { useFinishedGame: () => ({ ...ARCHIVED_SEASONS[0]!, preset_id: facts.presetId }) };
});
// Identity answers for the players the recap names; nothing else on the page answers.
vi.stubGlobal("fetch", (input: string | URL | Request) =>
  new URL(input instanceof Request ? input.url : String(input), "http://localhost").pathname.endsWith("/api/profiles")
    ? Promise.resolve(Response.json({ profiles: {} }))
    : new Promise<Response>(() => {}),
);
// A browser whose clipboard takes a PNG, so the recap's first step is Copy image.
vi.stubGlobal("ClipboardItem", { supports: (type: string) => type === "image/png" });
vi.stubGlobal("navigator", { ...navigator, clipboard: { write: async () => {} } });

vi.mock("@/ui/features/frontier/aspect/aspect-page", () => ({
  FrontierAspectPage: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close race board</button>,
}));

import { shortString } from "starknet";

import { setViewportWidth } from "../frame/test-viewport";
import { DEVCON } from "../join/devcon";
import { SeasonOver } from "./season-over";

const CANZI = "0x648174392d94df37bc7d59c3abf22116d20df16ddf0e380c5ff79aff86738c4";
/** The player's realm, and its home's CampaignHome row as the contract writes it: tier 1 a Devcon home, 2 a golden one. */
const REALM = { game_id: 1, entity_id: 7, base: { level: 1 } } as never;
const devconHome = (tier: 1 | 2) => ({
  game_id: 1,
  home: 7,
  campaign_id: shortString.encodeShortString(DEVCON.campaign),
  tier,
});

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  Object.assign(facts, { race: false, presetId: 6, viewer: null, campaignHome: undefined });
});

/** The season-over as the HUD mounts it, for a reader whose home has this CampaignHome row (none: free or held). */
const open = async ({
  presetId = 6,
  viewer = CANZI as string | null,
  campaignHome = devconHome(1) as unknown,
  width = 1440,
  race = false,
} = {}) => {
  Object.assign(facts, { race, presetId, viewer, campaignHome });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SeasonOver realm={REALM} withdraw={<button>Return principal</button>} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  // Let identity's names land.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  unmount = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return document.body;
};

const said = (page: Element) => page.textContent?.replace(/\s+/g, " ") ?? "";
const greeting = (page: HTMLElement) => page.querySelector(".festival-cover");
const ticket = (page: HTMLElement) => page.querySelector(".festival-gift")?.textContent?.replace(/\s+/g, " ");
/** The recap's row as drawn: an icon button's label, else its words with the step's number before them. */
const row = (page: HTMLElement) =>
  [...page.querySelectorAll<HTMLButtonElement>(".season-recap button[data-kind]")].map(
    (button) => button.getAttribute("aria-label") ?? button.textContent,
  );

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

it("promises a golden Devcon realm's owner the same special ticket, and names no tier", async () => {
  const page = await open({ campaignHome: devconHome(2) });
  expect(ticket(page)).toContain("You get a special Season 1 ticket");
  expect(said(greeting(page)!).toLowerCase()).not.toContain("golden");
});

it("opens the season's recap from See my season, with Exit and its two steps to post", async () => {
  const page = await open();
  await act(async () =>
    [...page.querySelectorAll("button")].find((button) => button.textContent === "See my season")!.click(),
  );
  expect(greeting(page)).toBeNull();
  expect(row(page)).toEqual(["Exit", "1Copy image", "2Post on X"]);
});

it("gives a home of no campaign (a free home, a held Realm) the season's usual end: the recap at once, no Diwali", async () => {
  for (const width of [1440, 390]) {
    const page = await open({ campaignHome: null, width });
    expect(greeting(page)).toBeNull();
    expect(said(page)).not.toContain("Diwali");
    expect(row(page)).toEqual(["Exit", "1Copy image", "2Post on X"]);
    await unmount!();
  }
});

it("greets no Devcon owner in another season, nor a reader with no realm on the board: the recap stands at once", async () => {
  for (const reader of [{ presetId: 0 }, { viewer: null }]) {
    const page = await open(reader);
    expect(greeting(page)).toBeNull();
    expect(page.querySelector(".season-recap")).not.toBeNull();
    await unmount!();
  }
});


it("opens the native race board and preserves principal return without requesting the old ranking", async () => {
  const page = await open({ race: true });
  expect(page.querySelector("[data-race-ended]")).not.toBeNull();
  expect(said(page)).toContain("Return principal");
  expect(page.querySelector(".season-recap")).toBeNull();
  await act(async () => [...page.querySelectorAll("button")].find((button) => button.textContent === "Close race board")!.click());
  expect(page.querySelector("[data-race-ended]")).toBeNull();
});
