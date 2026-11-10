import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

/** Prod's Playtest podium, as identity names it. */
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
  /** What each image drew: the node's words as it was made. */
  words: [] as string[],
}));
vi.mock("modern-screenshot", () => ({
  domToBlob: async (node: HTMLElement, options: { width: number; height: number }) => {
    snapshot.calls.push({ node, width: options.width, height: options.height });
    snapshot.words.push(node.textContent ?? "");
    if (snapshot.fails) throw new Error("canvas refused");
    return new Blob(["png"], { type: "image/png" });
  },
}));

/** The app the client runs in; the web unless a test says otherwise. */
const app = vi.hoisted(() => ({ channel: "web" as "web" | "play" | "app-store" }));
vi.mock("@/runtime/distribution-channel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/distribution-channel")>()),
  distributionChannel: () => app.channel,
}));

import type { HeraldFrontierLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { seasonPodium } from "@/ui/features/frontier/board/season-pool";
import { SeasonOverRecap } from "@/shell/season-tab/season-over";
import { SeasonRecap } from "@/shell/season-tab/season-recap";
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
  snapshot.words = [];
  app.channel = "web";
  vi.unstubAllGlobals();
});

const open = async ({
  width = 1440,
  viewer = CANZI,
  board = BOARD,
  onExit = vi.fn(),
  results = false,
}: {
  width?: number;
  viewer?: string | null;
  board?: HeraldFrontierLeaderboard;
  onExit?: () => void;
  /** The recap standing in a Results page, not covering the HUD. */
  results?: boolean;
} = {}) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  // What mounts the recap: the HUD, whose desktop draws under its own zoom, or a Results page.
  const host = Object.assign(document.createElement("div"), { id: "mount" });
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          {results ? (
            <SeasonRecap
              gameRef={SEASON_ONE}
              game={ARCHIVED_SEASONS[0]}
              board={board}
              viewer={viewer}
              ending="lifted"
              actions={null}
            />
          ) : (
            <SeasonOverRecap
              gameRef={SEASON_ONE}
              game={ARCHIVED_SEASONS[0]}
              board={board}
              viewer={viewer}
              ending="lifted"
              onExit={onExit}
            />
          )}
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
  // Over the HUD the recap stands at the body's end, where the player meets it; on Results, in the page.
  return document.body;
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
/** The steps as a player reads them: each button's word (an icon's, its label), without its step number. */
const steps = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLButtonElement>("button[data-kind]")].map((button) => [
    button.getAttribute("aria-label") ?? wordOf(button),
    button.dataset.kind,
  ]);
const wordOf = (button: HTMLElement) =>
  [...button.querySelectorAll("span")].map((span) => span.lastChild?.textContent ?? "").join("") || button.textContent;
const hint = (host: HTMLElement) => host.querySelector(".season-recap__hint")?.textContent ?? null;
const press = (host: HTMLElement, word: string) =>
  act(async () =>
    [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => (button.getAttribute("aria-label") ?? wordOf(button)) === word)!
      .click(),
  );
const pressLabelled = (host: HTMLElement, label: string) =>
  act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click());

it("tells the season and its ending, then the player's four cards: their place, the podium, their sites, their haul", async () => {
  const host = await open();
  expect([...host.querySelector("header")!.children].map((line) => line.textContent)).toEqual([
    "Playtest · Ended 31 Oct",
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
  ).toEqual(["Playtest", window.location.host]);
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

it("stands the podium in its card, the player's own place theirs, with Exit before the two steps to post", async () => {
  const onExit = vi.fn();
  pngClipboard();
  const host = await open({ onExit });
  expect(podium(host)).toEqual([
    ["1", "Volcanic", "166"],
    ["2", "djizus", "136"],
    ["3", "You", "114"],
  ]);
  expect(steps(host)).toEqual([
    ["Exit", "secondary"],
    ["Copy image", "secondary"],
    ["Post on X", "primary"],
  ]);
  await press(host, "Exit");
  expect(onExit.mock.calls.length).toBe(1);
});

it("shows a reader with no realm on the board the season and its podium card alone, with nothing to share", async () => {
  const host = await open({ viewer: null });
  expect(deck(host)).toBeNull();
  expect([...host.querySelectorAll<HTMLElement>(".season-card")].map((each) => each.dataset.card)).toEqual(["podium"]);
  // Outside the deck the card is named alone, with no number in it.
  expect(host.querySelector(".season-card__step")?.textContent).toBe("The podium");
  expect(podium(host)).toHaveLength(3);
  expect(steps(host).map(([word]) => word)).toEqual(["Exit"]);
  expect(hint(host)).toBeNull();
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
    clipboard: {
      write: async (items: PngClipboardItem[]) => {
        for (const item of items) copied.push(await item.items["image/png"]!);
      },
    },
  });
  return copied;
};

/** X's compose page as the game opened it: its address's page, post and link, and where it opened. */
const xPosts = () => {
  const opened = vi.fn();
  vi.stubGlobal("open", opened);
  return () =>
    (opened.mock.calls as [string, string][]).map(([href, target]) => {
      const post = new URL(href);
      return [post.origin + post.pathname, post.searchParams.get("text"), post.searchParams.get("url"), target];
    });
};

const RESULTS = `${window.location.origin}/results/0x50524f44554354494f4e5f31386530376435323330633539393933-1`;

it("posts the season on X in two steps: Copy image puts the deck's image on the clipboard, Post on X opens the post", async () => {
  const copied = pngClipboard();
  const posts = xPosts();
  const host = await open({ width: 1440 });
  expect(hint(host)).toBe("Copy the image, then paste it in your post on X.");
  await press(host, "Copy image");
  // The one image: the deck's own node at its wide size, the PNG the library made.
  expect(snapshot.calls).toEqual([{ node: deck(host), width: 1200, height: 675 }]);
  expect(copied.map((image) => image.type)).toEqual(["image/png"]);
  expect(steps(host).slice(-2)).toEqual([
    ["Image copied", "secondary"],
    ["Post on X", "primary"],
  ]);
  await press(host, "Post on X");
  expect(posts()).toEqual([["https://x.com/intent/tweet", "Playtest · #3 of 45 realms", RESULTS, "_blank"]]);
});

it("on a phone, keeps the steps in one row, Exit as its icon, and copies the tall deck", async () => {
  pngClipboard();
  const host = await open({ width: 390 });
  expect(steps(host)).toEqual([
    ["Exit", "secondary"],
    ["Copy image", "secondary"],
    ["Post on X", "primary"],
  ]);
  expect([...host.querySelectorAll('button[data-size="icon"]')].map((button) => button.textContent)).toEqual([""]);
  await press(host, "Copy image");
  expect(snapshot.calls).toEqual([{ node: deck(host), width: 1080, height: 1350 }]);
});

it("where the clipboard takes no PNG, saves the deck's image instead, and the hint says to add it to the post", async () => {
  vi.stubGlobal(
    "ClipboardItem",
    class {
      static supports = (type: string) => type === "text/plain";
    },
  );
  vi.stubGlobal("navigator", { ...navigator, clipboard: { write: async () => {} } });
  const saved: string[] = [];
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download);
  });
  URL.createObjectURL = () => "blob:card";
  URL.revokeObjectURL = () => {};
  const host = await open({ width: 1440 });
  expect(hint(host)).toBe("Save the image, then add it to your post on X.");
  await press(host, "Save image");
  expect(snapshot.calls.map(({ width, height }) => [width, height])).toEqual([[1200, 675]]);
  expect(saved).toEqual(["my-season.png"]);
  expect(steps(host).slice(-2)).toEqual([
    ["Image saved", "secondary"],
    ["Post on X", "primary"],
  ]);
  click.mockRestore();
});

it("says the image could not be made when the copy fails, and keeps Copy image to try again", async () => {
  pngClipboard();
  snapshot.fails = true;
  const host = await open({ width: 1440 });
  await press(host, "Copy image");
  expect(host.querySelector("[role=alert]")?.textContent).toBe("The image could not be made.");
  expect(steps(host).slice(-2)).toEqual([
    ["Copy image", "secondary"],
    ["Post on X", "primary"],
  ]);
});

/** A phone whose share sheet takes an image file, answering each share as `answer` does; each share it is handed. */
const shareSheet = (answer: () => Promise<void> = async () => {}) => {
  const shared: { files: File[]; text: string; url: string }[] = [];
  vi.stubGlobal("navigator", {
    ...navigator,
    canShare: ({ files }: { files?: File[] }) => (files?.length ?? 0) > 0,
    share: (data: { files: File[]; text: string; url: string }) => {
      shared.push(data);
      return answer();
    },
  });
  return shared;
};
const refusal = (name: string) => () => Promise.reject(Object.assign(new Error(name), { name }));

it("in the iOS app, shares the season in one press through iOS's sheet: the deck's image, its line and Results", async () => {
  app.channel = "app-store";
  const shared = shareSheet();
  const host = await open({ width: 390 });
  expect(steps(host)).toEqual([
    ["Exit", "secondary"],
    ["Share", "primary"],
  ]);
  expect(hint(host)).toBeNull();
  // Made before the press, as the sheet opens only within it, and once the podium's names are read.
  expect(snapshot.calls).toEqual([{ node: deck(host), width: 1080, height: 1350 }]);
  expect(snapshot.words[0]).toContain("Volcanic");
  expect(snapshot.words[0]).not.toContain("…");
  await press(host, "Share");
  expect(shared.map(({ files, text, url }) => [files.map((file) => [file.name, file.type]), text, url])).toEqual([
    [[["my-season.png", "image/png"]], "Playtest · #3 of 45 realms", RESULTS],
  ]);
  expect(host.querySelector("[role=alert]")).toBeNull();
});

it("in the iOS app, makes the deck's image only once identity has answered for every player it names", async () => {
  app.channel = "app-store";
  shareSheet();
  let answer = () => {};
  const answered = new Promise<void>((resolve) => (answer = resolve));
  vi.stubGlobal("fetch", () => answered.then(() => Response.json({ profiles: {} })));
  // Players identity has not been asked for yet in this file: their names are still being read.
  const unasked = (address: string) => `0x7${address.slice(3)}`;
  const board = { ...BOARD, entries: BOARD.entries.map((entry) => ({ ...entry, address: unasked(entry.address) })) };
  await open({ width: 390, board, viewer: unasked(CANZI) });
  expect(snapshot.calls).toEqual([]);
  await act(async () => {
    answer();
    for (let tick = 0; tick < 5; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(snapshot.calls).toHaveLength(1);
  expect(snapshot.words[0]).not.toContain("…");
});

it("in the iOS app, keeps Share when the player closes the sheet", async () => {
  app.channel = "app-store";
  shareSheet(refusal("AbortError"));
  const host = await open({ width: 390 });
  await press(host, "Share");
  expect(steps(host).at(-1)).toEqual(["Share", "primary"]);
  expect(host.querySelector("[role=alert]")).toBeNull();
});

it("in the iOS app, falls back to the two steps when the sheet does not open, and says so", async () => {
  app.channel = "app-store";
  pngClipboard();
  shareSheet(refusal("NotAllowedError"));
  const host = await open({ width: 390 });
  await press(host, "Share");
  expect(host.querySelector("[role=alert]")?.textContent).toBe(
    "Sharing did not open. Copy the image and post it instead.",
  );
  expect(steps(host)).toEqual([
    ["Exit", "secondary"],
    ["Copy image", "secondary"],
    ["Post on X", "primary"],
  ]);
});

it.each(["web", "play"] as const)(
  "on the %s channel, keeps the two steps even where the phone's sheet takes images, and makes no image unasked",
  async (channel) => {
    app.channel = channel;
    pngClipboard();
    const shared = shareSheet();
    const host = await open({ width: 390 });
    expect(steps(host)).toEqual([
      ["Exit", "secondary"],
      ["Copy image", "secondary"],
      ["Post on X", "primary"],
    ]);
    expect(hint(host)).toBe("Copy the image, then paste it in your post on X.");
    expect(snapshot.calls).toEqual([]);
    expect(shared).toEqual([]);
  },
);

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
const roomIs = (width: number, height = 900) =>
  act(async () => {
    for (const [node, told] of watched)
      if (node.isConnected) told([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);
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

it("over the HUD, fits the four cards to the height the season and the steps leave, never below their words' least size", async () => {
  watched.clear();
  vi.stubGlobal("ResizeObserver", RoomObserver);
  const host = await open({ width: 1280 });
  const fit = () => host.querySelector<HTMLElement>(".season-recap__scaler")!.style.transform;
  const shared = () => host.querySelector<HTMLElement>(".season-recap__layout")!.style.getPropertyValue("--deck-width");
  // A 1280 × 720 laptop leaves the cards 1,200 px across and 506 px down: they stand 900 px wide (506 × 16 / 9), and
  // the season above and the steps under them take that width too.
  await roomIs(1200, 506.25);
  expect(fit()).toBe(`scale(${900 / 1200})`);
  expect(shared()).toBe("900px");
  // A room too short for the deck's smallest words (19 px) to read at 14 px keeps it at that size: the recap scrolls.
  await roomIs(1200, 300);
  expect(fit()).toBe(`scale(${14 / 19})`);
  // A tall room fills its width.
  await roomIs(1200, 900);
  expect(fit()).toBe("scale(1)");
});

it("covers the HUD from the body's end, clear of the zoom the desktop HUD draws under, and stands in a Results page", async () => {
  const mountOf = (host: HTMLElement) => host.querySelector(".season-recap")!.closest("#mount");
  expect(mountOf(await open())).toBeNull();
  await unmount!();
  expect(mountOf(await open({ results: true }))).not.toBeNull();
});

it("on Results, fits the four cards to the page's width, which scrolls under them", async () => {
  watched.clear();
  vi.stubGlobal("ResizeObserver", RoomObserver);
  const host = await open({ width: 1280, results: true });
  await roomIs(1200, 300);
  expect(host.querySelector<HTMLElement>(".season-recap__scaler")!.style.transform).toBe("scale(1)");
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
