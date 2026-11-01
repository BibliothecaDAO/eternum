import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

/** Prod's Season 1 podium, as identity names it. */
const NAMES = vi.hoisted(
  () =>
    ({
      "0x4c21ba6f5c8e24182ee0eefd56de97ade5f7570041dd0ec7d7d8ece2195cc4": "Volcanic",
      "0x510fa645565fc77a784918630a27d0e1c07255b698fb44966ebd0b801439001": "djizus",
      "0x648174392d94df37bc7d59c3abf22116d20df16ddf0e380c5ff79aff86738c4": "Canzi",
    }) as Record<string, string>,
);
vi.hoisted(() =>
  vi.stubGlobal("fetch", (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
    const accounts = url.searchParams.get("accounts")?.split(",") ?? [];
    if (!url.pathname.endsWith("/api/profiles")) return new Promise<Response>(() => {});
    return Promise.resolve(
      Response.json({
        profiles: Object.fromEntries(
          accounts.filter((account) => NAMES[account]).map((account) => [account, { name: NAMES[account] }]),
        ),
      }),
    );
  }),
);
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));
/** The image library at its edge: the node it was handed and the size asked, answered with a PNG or a failure. */
const snapshot = vi.hoisted(() => ({
  fails: false,
  calls: [] as { node: HTMLElement; width: number; height: number }[],
}));
vi.mock("modern-screenshot", () => ({
  domToBlob: async (node: HTMLElement, options: { width: number; height: number }) => {
    snapshot.calls.push({ node, width: options.width, height: options.height });
    if (snapshot.fails) throw new Error("canvas refused");
    return new Blob(["png"], { type: "image/png" });
  },
}));

import type { HeraldFrontierLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { seasonPodium } from "@/ui/features/frontier/board/season-pool";
import { SeasonOverRecap } from "@/ui/features/frontier/board/season-board";
import { setViewportWidth } from "../frame/test-viewport";
import { ARCHIVED_SEASONS, archivedSeason } from "./archive/archive";

const SEASON_ONE = { chainId: ARCHIVED_SEASONS[0]!.chainId, gameId: ARCHIVED_SEASONS[0]!.game_id };
const BOARD = archivedSeason(SEASON_ONE)!.board;
const CANZI = "0x648174392d94df37bc7d59c3abf22116d20df16ddf0e380c5ff79aff86738c4";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  snapshot.fails = false;
  snapshot.calls = [];
  vi.unstubAllGlobals();
});

const open = async ({
  width = 1440,
  viewer = CANZI,
  board = BOARD,
  onSeason = vi.fn(),
  onExit = vi.fn(),
}: {
  width?: number;
  viewer?: string | null;
  board?: HeraldFrontierLeaderboard;
  onSeason?: () => void;
  onExit?: () => void;
} = {}) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SeasonOverRecap
            gameRef={SEASON_ONE}
            game={ARCHIVED_SEASONS[0]}
            board={board}
            viewer={viewer}
            ending="lifted"
            onSeason={onSeason}
            onExit={onExit}
          />
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
  return host;
};

const card = (host: HTMLElement) => host.querySelector<HTMLElement>(".season-card");
const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, " ").trim();
const cells = (node: Element) => [...node.children].map((cell) => cell.textContent);
/** The podium's places, each as its cells: place, name, sites cleared and the prize it pays. */
const podium = (host: HTMLElement) =>
  [...host.querySelectorAll(".season-recap__podium li")].map((place) =>
    [...place.children].map((cell) => cell.textContent),
  );
const steps = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLButtonElement>("button[data-kind]")].map((button) => [
    button.textContent,
    button.dataset.kind,
  ]);
const press = (host: HTMLElement, word: string) =>
  act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === word)!.click());

it("tells the season and its ending, then the player's card: their name, place of the field, season and sites by kind", async () => {
  const host = await open();
  expect([...host.querySelector("header")!.children].map((line) => line.textContent)).toEqual([
    "Season 1 · Playtest · Ended 31 Oct",
    "The mist lifted",
  ]);
  const drawn = card(host)!;
  expect(text(drawn.querySelector(".season-card__kick"))).toBe("Season 1 · Playtest");
  expect(text(drawn.querySelector(".season-card__name"))).toBe("Canzi");
  expect(cells(drawn.querySelector(".season-card__place")!)).toEqual(["#3", "of 45 realms"]);
  // Each figure: its value over its name.
  expect([...drawn.querySelectorAll(".season-card__figure > span")].map(cells)).toEqual([
    ["114", "Sites cleared"],
    ["3", "Chests"],
    ["450", "LORDS"],
    ["173.4K", "Essence"],
  ]);
  // Camps, rifts, ruins and beasts, as Herald counts them; no Depth for a realm that never went through.
  expect([...drawn.querySelectorAll(".season-card__kinds > span")].map(text)).toEqual(["19", "32", "3", "60"]);
  // No pool that season: no prize on the card.
  expect(drawn.querySelector(".season-card__prize")).toBeNull();
});

it("draws the wide cut on a desktop and the tall one on a phone, each at the size it is shared", async () => {
  const wide = await open({ width: 1440 });
  expect([card(wide)!.style.width, card(wide)!.style.height]).toEqual(["1200px", "675px"]);
  await unmount!();
  const tall = await open({ width: 390 });
  expect([card(tall)!.style.width, card(tall)!.style.height]).toEqual(["1080px", "1350px"]);
});

it("stands the podium beside it, the player's own place theirs, with Season and Exit before Share my season", async () => {
  const onSeason = vi.fn();
  const onExit = vi.fn();
  const host = await open({ onSeason, onExit });
  expect(podium(host)).toEqual([
    ["1", "Volcanic", "166"],
    ["2", "djizus", "136"],
    ["3", "You", "114"],
  ]);
  expect(steps(host)).toEqual([
    ["Season", "secondary"],
    ["Exit", "secondary"],
    ["Share my season", "primary"],
  ]);
  await press(host, "Season");
  await press(host, "Exit");
  expect([onSeason.mock.calls.length, onExit.mock.calls.length]).toEqual([1, 1]);
});

it("shows a reader with no realm on the board the season and its podium, with no card and nothing to share", async () => {
  const host = await open({ viewer: null });
  expect(card(host)).toBeNull();
  expect(host.querySelectorAll(".season-recap__podium li")).toHaveLength(3);
  expect(steps(host).map(([word]) => word)).toEqual(["Season", "Exit"]);
});

it("names the prize a place pays, on the card and on the podium, once the season has a pool", async () => {
  const board = { ...BOARD, prize: { pool: "300000", top_n: 3, count: null, awards: [] } };
  const prizes = seasonPodium(board)!.map(({ lords }) => lords.toLocaleString("en-US"));
  const host = await open({ board });
  expect(text(card(host)!.querySelector(".season-card__prize"))).toBe(`Prize · ${prizes[2]} LORDS`);
  expect(podium(host)).toEqual([
    ["1", "Volcanic", "166", prizes[0]],
    ["2", "djizus", "136", prizes[1]],
    ["3", "You", "114", prizes[2]],
  ]);
});

it("on a phone, shares the tall card as an image through the share sheet, with the season's line and its Results", async () => {
  const share = vi.fn(() => Promise.resolve());
  vi.stubGlobal("navigator", { ...navigator, canShare: () => true, share });
  const host = await open({ width: 390 });
  await press(host, "Share my season");
  expect(snapshot.calls).toEqual([{ node: card(host), width: 1080, height: 1350 }]);
  const [sent] = share.mock.calls[0] as unknown as [{ files: File[]; text: string; url: string }];
  expect([sent.files.map((file) => [file.name, file.type]), sent.text]).toEqual([
    [["my-season.png", "image/png"]],
    "Season 1 · Playtest · #3 of 45 realms",
  ]);
  expect(sent.url).toBe(`${window.location.origin}/results/0x50524f44554354494f4e5f31386530376435323330633539393933-1`);
});

it("on a desktop with no share sheet for images, saves the wide card and says so", async () => {
  vi.stubGlobal("navigator", { ...navigator, canShare: undefined });
  const saved: string[] = [];
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download);
  });
  URL.createObjectURL = () => "blob:card";
  URL.revokeObjectURL = () => {};
  const host = await open({ width: 1440 });
  await press(host, "Share my season");
  expect(snapshot.calls.map(({ width, height }) => [width, height])).toEqual([[1200, 675]]);
  expect(saved).toEqual(["my-season.png"]);
  expect(steps(host).at(-1)).toEqual(["Image saved", "primary"]);
  click.mockRestore();
});

it("says so when the image cannot be made, and keeps Share my season to try again", async () => {
  snapshot.fails = true;
  const host = await open();
  await press(host, "Share my season");
  expect(host.querySelector("[role=alert]")?.textContent).toBe("The image could not be made.");
  expect(steps(host).at(-1)).toEqual(["Share my season", "primary"]);
});
