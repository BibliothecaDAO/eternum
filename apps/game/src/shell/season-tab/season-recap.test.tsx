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
import { SITE_KINDS } from "@/ui/features/frontier/board/season-detail";
import { TARGET_MARKS } from "@/ui/features/frontier/sites/site-marks";
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

/** The deck, the node Share makes into an image; and one of its cards. */
const deck = (host: HTMLElement) => host.querySelector<HTMLElement>(".season-deck");
const card = (host: HTMLElement, name: string) => host.querySelector<HTMLElement>(`[data-card="${name}"]`);
const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, " ").trim();
/** The podium card's places, each as its cells: place, name, sites cleared and the prize it pays. */
const podium = (host: HTMLElement) =>
  [...host.querySelectorAll('[data-card="podium"] li')].map((place) =>
    [...place.querySelectorAll("b, .season-card__holder, .season-card__count")].map((cell) => cell.textContent),
  );
/** A card's tiles, each as its value and its name. */
const tiles = (node: Element) =>
  [...node.querySelectorAll(".season-card__tile")].map((tile) =>
    [...tile.querySelectorAll("b, small")].map((cell) => cell.textContent),
  );
const steps = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLButtonElement>("button[data-kind]")].map((button) => [
    button.textContent,
    button.dataset.kind,
  ]);
const press = (host: HTMLElement, word: string) =>
  act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === word)!.click());
const pressLabelled = (host: HTMLElement, label: string) =>
  act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click());

it("tells the season and its ending, then the player's four cards: their place, the podium, their sites, their haul", async () => {
  const host = await open();
  expect([...host.querySelector("header")!.children].map((line) => line.textContent)).toEqual([
    "Season 1 · Playtest · Ended 31 Oct",
    "The mist lifted",
  ]);
  expect([...deck(host)!.querySelectorAll(".season-card__step")].map((step) => step.textContent)).toEqual([
    "1 · Your place",
    "2 · The podium",
    "3 · Your sites",
    "4 · Your haul",
  ]);
  const place = card(host, "place")!;
  expect(
    [".season-card__rank", ".season-card__of", ".season-card__name"].map((part) => text(place.querySelector(part))),
  ).toEqual(["#3", "of 45 realms", "Canzi"]);
  // No pool that season: no prize on the card.
  expect(place.querySelector(".season-card__prize")).toBeNull();
  expect(text(card(host, "podium")!.querySelector("h2"))).toBe("Volcanic took the season");
  // Camps, rifts, ruins and beasts, as Herald counts them; no Depth for a realm that never went through.
  const sites = card(host, "sites")!;
  expect(text(sites.querySelector(".season-card__big"))).toBe("114");
  expect(tiles(sites)).toEqual(
    SITE_KINDS.map((kind, index) => [["19", "32", "3", "60"][index], TARGET_MARKS[kind].word]),
  );
  expect(sites.querySelector(".season-card__depth")).toBeNull();
  expect(tiles(card(host, "haul")!)).toEqual([
    ["3", "Chests"],
    ["450", "LORDS"],
    ["173.4K", "Essence"],
    ["42.5K", "Labor"],
  ]);
  // The deck's foot: Frontier's lockup, the season, where to play.
  expect(
    [...deck(host)!.querySelectorAll(".season-deck__foot > span:not(.app-game-name)")].map((part) => part.textContent),
  ).toEqual(["Season 1 · Playtest", window.location.host]);
});

it("draws the wide cut on a desktop and the tall one on a phone, each at the size it is shared", async () => {
  const wide = await open({ width: 1440 });
  expect([deck(wide)!.style.width, deck(wide)!.style.height]).toEqual(["1200px", "675px"]);
  await unmount!();
  const tall = await open({ width: 390 });
  expect([deck(tall)!.style.width, deck(tall)!.style.height]).toEqual(["1080px", "1350px"]);
});

it("on a phone, steps through the four cards as a story: a mark each, a tap on to the next and back, a swipe too", async () => {
  const host = await open({ width: 390 });
  const frame = () => host.querySelector<HTMLElement>(".season-recap__frame")!;
  const marks = () => [...host.querySelectorAll(".season-recap__ticks li")].map((mark) => mark.hasAttribute("data-on"));
  expect([frame().dataset.card, marks()]).toEqual(["place", [true, false, false, false]]);
  await pressLabelled(host, "Next card");
  expect([frame().dataset.card, marks()]).toEqual(["podium", [true, true, false, false]]);
  await pressLabelled(host, "Previous card");
  expect(frame().dataset.card).toBe("place");
  // A swipe left goes on; past the last card the story stays on it.
  const swipe = (from: number, to: number) =>
    act(async () => {
      frame().dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: from }));
      frame().dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: to }));
    });
  await swipe(300, 100);
  expect(frame().dataset.card).toBe("podium");
  await pressLabelled(host, "Next card");
  await pressLabelled(host, "Next card");
  await pressLabelled(host, "Next card");
  expect([frame().dataset.card, marks()]).toEqual(["haul", [true, true, true, true]]);
});

it("shows a desktop the whole deck, with no story to step", async () => {
  const host = await open({ width: 1440 });
  expect(host.querySelector(".season-recap__ticks")).toBeNull();
  expect(host.querySelector('button[aria-label="Next card"]')).toBeNull();
});

it("stands the podium in its card, the player's own place theirs, with Season and Exit before Share my season", async () => {
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

it("shows a reader with no realm on the board the season and its podium card alone, with nothing to share", async () => {
  const host = await open({ viewer: null });
  expect(deck(host)).toBeNull();
  expect([...host.querySelectorAll<HTMLElement>(".season-card")].map((each) => each.dataset.card)).toEqual(["podium"]);
  // Outside the deck the card is named alone, with no number in it.
  expect(host.querySelector(".season-card__step")?.textContent).toBe("The podium");
  expect(podium(host)).toHaveLength(3);
  expect(steps(host).map(([word]) => word)).toEqual(["Season", "Exit"]);
});

it("names the prize a place pays, on the place card and on the podium, once the season has a pool", async () => {
  const board = { ...BOARD, prize: { pool: "300000", top_n: 3, count: null, awards: [] } };
  const prizes = seasonPodium(board)!.map(({ lords }) => lords.toLocaleString("en-US"));
  const host = await open({ board });
  expect(text(card(host, "place")!.querySelector(".season-card__prize"))).toBe(`Prize · ${prizes[2]} LORDS`);
  expect(podium(host)).toEqual([
    ["1", "Volcanic", "166", prizes[0]],
    ["2", "djizus", "136", prizes[1]],
    ["3", "You", "114", prizes[2]],
  ]);
});

it("on a phone, shares the tall deck as an image through the share sheet, with the season's line and its Results", async () => {
  const share = vi.fn(() => Promise.resolve());
  vi.stubGlobal("navigator", { ...navigator, canShare: () => true, share });
  const host = await open({ width: 390 });
  await press(host, "Share my season");
  expect(snapshot.calls).toEqual([{ node: deck(host), width: 1080, height: 1350 }]);
  const [sent] = share.mock.calls[0] as unknown as [{ files: File[]; text: string; url: string }];
  expect([sent.files.map((file) => [file.name, file.type]), sent.text]).toEqual([
    [["my-season.png", "image/png"]],
    "Season 1 · Playtest · #3 of 45 realms",
  ]);
  expect(sent.url).toBe(`${window.location.origin}/results/0x50524f44554354494f4e5f31386530376435323330633539393933-1`);
});

it("on a desktop with no share sheet for images, saves the wide deck and says so", async () => {
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

/**
 * A clipboard that takes PNGs, at its edge: each write keeps the image it was handed once that image is made, and a
 * write fails when its image does.
 */
const pngClipboard = () => {
  const copied: Blob[] = [];
  class PngClipboardItem {
    static supports = (type: string) => type === "image/png";
    constructor(readonly items: Record<string, Promise<Blob>>) {}
  }
  vi.stubGlobal("ClipboardItem", PngClipboardItem);
  vi.stubGlobal("navigator", {
    ...navigator,
    canShare: undefined,
    clipboard: {
      write: async (items: PngClipboardItem[]) => {
        for (const item of items) copied.push(await item.items["image/png"]!);
      },
    },
  });
  return copied;
};

it("on a desktop whose clipboard takes images, copies the same deck image from a quiet Copy image beside Share", async () => {
  const copied = pngClipboard();
  const host = await open({ width: 1440 });
  expect(steps(host).slice(-2)).toEqual([
    ["Copy image", "quiet"],
    ["Share my season", "primary"],
  ]);
  await press(host, "Copy image");
  // The one image: the deck's own node at its wide size, the PNG the library made.
  expect(snapshot.calls).toEqual([{ node: deck(host), width: 1200, height: 675 }]);
  expect(copied.map((image) => image.type)).toEqual(["image/png"]);
  expect(steps(host).slice(-2)).toEqual([
    ["Image copied", "quiet"],
    ["Share my season", "primary"],
  ]);
});

it("offers no Copy image where the clipboard takes no PNG, nor on a phone, which shares", async () => {
  vi.stubGlobal(
    "ClipboardItem",
    class {
      static supports = (type: string) => type === "text/plain";
    },
  );
  vi.stubGlobal("navigator", { ...navigator, clipboard: { write: async () => {} } });
  const noPng = await open({ width: 1440 });
  expect(steps(noPng).map(([word]) => word)).toEqual(["Season", "Exit", "Share my season"]);
  await unmount!();
  pngClipboard();
  const phone = await open({ width: 390 });
  expect(steps(phone).map(([word]) => word)).toEqual(["Season", "Exit", "Share my season"]);
});

it("says the image could not be made when the copy fails, and keeps Copy image to try again", async () => {
  pngClipboard();
  snapshot.fails = true;
  const host = await open({ width: 1440 });
  await press(host, "Copy image");
  expect(host.querySelector("[role=alert]")?.textContent).toBe("The image could not be made.");
  expect(steps(host).slice(-2)).toEqual([
    ["Copy image", "quiet"],
    ["Share my season", "primary"],
  ]);
});

/**
 * jsdom has no ResizeObserver: each one records the node it watches, and a room's width is delivered, as a browser
 * does, only to the watched nodes still on the page.
 */
const watched = new Map<Element, ResizeObserverCallback>();
class RoomObserver {
  constructor(private readonly told: ResizeObserverCallback) {}
  observe(node: Element) {
    watched.set(node, this.told);
  }
  unobserve(node: Element) {
    watched.delete(node);
  }
  disconnect() {
    for (const [node, told] of watched) if (told === this.told) watched.delete(node);
  }
}
const roomIs = (width: number) =>
  act(async () => {
    for (const [node, told] of watched)
      if (node.isConnected) told([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
  });

it("fits the deck to its room as the window widens past the phone's breakpoint and narrows back, measuring each room", async () => {
  watched.clear();
  vi.stubGlobal("ResizeObserver", RoomObserver);
  const host = await open({ width: 390 });
  const fit = () => host.querySelector<HTMLElement>(".season-recap__scaler")!.style.transform;
  // A phone: the story's frame is 358 px, one tall card (485 px) at a time, the first at the deck's margin.
  await roomIs(358);
  expect(fit()).toBe(`scale(${358 / 485}) translate(-40px, -40px)`);
  // Widened to a desktop: the whole wide deck (1200 px) fills the 1,360 px room, not the phone's old measure.
  await act(async () => setViewportWidth(1440));
  await roomIs(1360);
  expect(fit()).toBe(`scale(${1360 / 1200})`);
  // And back.
  await act(async () => setViewportWidth(390));
  await roomIs(358);
  expect(fit()).toBe(`scale(${358 / 485}) translate(-40px, -40px)`);
});

it("in the story, a mouse drag across Next steps once, a drag back across it once back, and a tap or a key one", async () => {
  const host = await open({ width: 390 });
  const next = host.querySelector<HTMLButtonElement>('button[aria-label="Next card"]')!;
  const shown = () => host.querySelector<HTMLElement>(".season-recap__frame")!.dataset.card;
  // A mouse press as the browser reports it over the overlaid control: down, up, then the click it ends in (a pointer's
  // click counts one, `detail` 1).
  const press = (from: number, to: number) =>
    act(async () => {
      next.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: from }));
      next.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: to }));
      next.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: to, detail: 1 }));
    });
  await press(320, 220);
  expect(shown()).toBe("podium");
  await press(220, 320);
  expect(shown()).toBe("place");
  // A tap barely moves: Next steps on.
  await press(300, 302);
  expect(shown()).toBe("podium");
  // A key presses Next with no pointer at all.
  await act(async () => next.click());
  expect(shown()).toBe("sites");
});

it("in the story, a key presses Next after a touch swipe, which ends in no click, and steps once", async () => {
  const host = await open({ width: 390 });
  const next = host.querySelector<HTMLButtonElement>('button[aria-label="Next card"]')!;
  const shown = () => host.querySelector<HTMLElement>(".season-recap__frame")!.dataset.card;
  // A touch swipe left over Next: down and up, and no click after it.
  await act(async () => {
    next.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 320 }));
    next.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 220 }));
  });
  expect(shown()).toBe("podium");
  // Then Enter on Next: a click no pointer made.
  await act(async () => next.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })));
  expect(shown()).toBe("sites");
});
