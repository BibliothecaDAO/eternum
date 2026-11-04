import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setViewportWidth } from "@/shell/frame/test-viewport";

import { SeasonDetailSheet } from "./season-detail";
import { SeasonList, type SeasonListRow } from "./season-list";
import { seasonPodium } from "./season-pool";
import { TARGET_MARKS } from "../sites/site-marks";

const render = (node: ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, unmount: () => act(() => root.unmount()) };
};

const row = (rank: number, own = false): SeasonListRow => ({
  key: `realm-${rank}`,
  rank,
  order: rank,
  realm: { level: 1, depth: 0 },
  name: `Realm ${rank}`,
  label: `Realm ${rank}`,
  sitesCleared: 100 - rank,
  lords: 50,
  own,
});

const button = (host: HTMLElement, word: string) =>
  [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === word)!;

describe("the season list", () => {
  it("says how to climb, with each site kind's painting and name, while the player is off the podium or has cleared none", () => {
    const climb = (rows: SeasonListRow[]) => {
      const { host, unmount } = render(
        <SeasonList rank={null} rows={rows} state="ready" onRetry={vi.fn()} onOpen={vi.fn()} onClose={vi.fn()} />,
      );
      const line = host.querySelector("[data-climb]")?.textContent ?? null;
      unmount();
      return line;
    };
    const said = `Clear sites with your armies to climb${["Camp", "Rift", "Ruin", "Beasts"]
      .map((kind) => TARGET_MARKS[kind as keyof typeof TARGET_MARKS].word)
      .join("")}`;
    expect(climb([row(1), row(2), row(12, true)])).toBe(said);
    // On the podium with sites cleared: nothing to explain. Nothing cleared yet, even first: the line.
    expect(climb([row(1, true), row(2)])).toBeNull();
    expect(
      climb([
        { ...row(1, true), sitesCleared: 0 },
        { ...row(2), sitesCleared: 0 },
      ]),
    ).toBe(said);
    // A spectator has no row to climb with.
    expect(climb([row(1), row(2)])).toBeNull();
  });

  it("names its columns, lists the realms with the player's own lit and opens a row, with no Back", () => {
    const onOpen = vi.fn();
    const { host, unmount } = render(
      <SeasonList
        rank={12}
        rows={[row(1), row(2), row(12, true)]}
        state="ready"
        onRetry={vi.fn()}
        onOpen={onOpen}
        onClose={vi.fn()}
      />,
    );
    expect([...host.querySelectorAll(".ui-table-head > span")].map((head) => head.textContent)).toEqual([
      "Rank",
      "Realm",
      "Sites",
      "LORDS",
    ]);
    expect(
      [...host.querySelectorAll(".ui-table-head > [data-tip]")].map((head) => head.getAttribute("data-tip")),
    ).toEqual(["Ranked by sites cleared, then deepest depth", "LORDS earned"]);
    const own = host.querySelector("button[aria-current='true']")!;
    expect(own.textContent).toContain("Realm 12");
    expect(host.querySelector("[aria-label='Season #12']")).not.toBeNull();
    act(() =>
      [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("Realm 2"))!.click(),
    );
    expect(onOpen).toHaveBeenCalledWith("realm-2");
    // Season is a place: the place bar leaves it, so the page has no Back of its own.
    expect(host.querySelector("button[aria-label='Back']")).toBeNull();
    unmount();
  });

  it("closes as every panel does: its X and Escape (audit 10-27: the desktop Season had neither)", () => {
    const onClose = vi.fn();
    const { host, unmount } = render(
      <SeasonList rank={1} rows={[row(1, true)]} state="ready" onRetry={vi.fn()} onOpen={vi.fn()} onClose={onClose} />,
    );
    act(() => host.querySelector<HTMLButtonElement>("button[aria-label='Close']")!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("says when the season ends and today against its last day (audit 10-27: shown nowhere)", () => {
    const at = new Date(2026, 9, 31, 21, 40).getTime() / 1000;
    const { host, unmount } = render(
      <SeasonList
        rank={1}
        rows={[row(1, true)]}
        state="ready"
        onRetry={vi.fn()}
        onOpen={vi.fn()}
        onClose={vi.fn()}
        ends={{ at, day: 10, lastDay: 14 }}
      />,
    );
    expect(host.textContent).toContain("Season ends 31 Oct 21:40 · Day 10 of 14");
    unmount();
  });

  it("says the season did not answer, with Try again on the card", () => {
    const onRetry = vi.fn();
    const { host, unmount } = render(
      <SeasonList rank={undefined} rows={[]} state="failed" onRetry={onRetry} onOpen={vi.fn()} onClose={vi.fn()} />,
    );
    expect(host.textContent).toContain("Season did not answer.");
    expect(host.querySelector("[aria-label='Season —']")).not.toBeNull();
    act(() => button(host, "Try again").click());
    expect(onRetry).toHaveBeenCalled();
    unmount();
  });

  it("draws each kind of site cleared as the attack cards draw it: its guard's painting and its name (one source)", () => {
    const sites = { total: 10, camps: 1, rifts: 2, ruins: 3, beasts: 4 };
    const detail = { rank: 2, order: 2, sites, chests: 0, lords: 0, depth: 0, essence: 0, labor: 0 };
    const { host, unmount } = render(<SeasonDetailSheet detail={detail} label="Aldric" onClose={vi.fn()} />);
    const chip = (name: string) => host.querySelector(`[aria-label='${name}']`);
    for (const [kind, count] of [
      ["Camp", 1],
      ["Rift", 2],
      ["Ruin", 3],
      ["Beasts", 4],
    ] as const) {
      const { word, icon } = TARGET_MARKS[kind];
      expect(chip(`${word} ${count}`)?.querySelector("[data-icon]")?.getAttribute("data-icon")).toBe(icon);
    }
    // Frontier's rift and roaming beasts are their guards, never a landmark or a troop.
    expect(TARGET_MARKS.Rift.icon).toBe("beast-dark-fey");
    expect(host.querySelector("[data-icon='troops']")).toBeNull();
    unmount();
  });

  it("details a realm's season by kind and its Ethereal layer once it has one, with Visit for another realm and none for the player's own", () => {
    const detail = {
      rank: 2,
      order: 2,
      sites: { total: 132, camps: 70, rifts: 43, ruins: 9, beasts: 10 },
      chests: 9,
      lords: 640,
      depth: 0,
      essence: 212_000,
      labor: 96_000,
    };
    const onVisit = vi.fn();
    const other = render(<SeasonDetailSheet detail={detail} label="Aldric" onVisit={onVisit} onClose={vi.fn()} />);
    expect(other.host.querySelector("[aria-label='Ruin 9']")).not.toBeNull();
    // No Ethereal layer is drawn until the realm has gone through its spire.
    expect(other.host.querySelector("[aria-label^='Ethereal']")).toBeNull();
    act(() => button(other.host, "Visit").click());
    expect(onVisit).toHaveBeenCalled();
    other.unmount();
    const own = render(<SeasonDetailSheet detail={{ ...detail, depth: 2 }} label="You" onClose={vi.fn()} />);
    expect(own.host.querySelector("[aria-label='Ethereal II']")).not.toBeNull();
    expect(button(own.host, "Visit")).toBeUndefined();
    own.unmount();
  });
});

describe("the season's prizes in game", () => {
  afterEach(() => vi.unstubAllGlobals());
  const sheet = (podium: Parameters<typeof SeasonList>[0]["podium"], width: number) => {
    setViewportWidth(width);
    return render(
      <SeasonList
        rank={12}
        podium={podium}
        rows={[...[1, 2, 3, 4].map((rank) => row(rank)), row(12, true), ...[13, 14].map((rank) => row(rank))]}
        state="ready"
        onRetry={vi.fn()}
        onOpen={vi.fn()}
        onClose={vi.fn()}
        ends={{ at: Date.UTC(2026, 10, 6, 19), day: 1, lastDay: 11 }}
      />,
    );
  };
  const tiles = (host: HTMLElement) =>
    [...host.querySelectorAll('[aria-label="Season prizes"] li[data-place]')].map((tile) => tile.textContent);
  const folded = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[aria-label="Season prizes"]');
  const foldedPlaces = (host: HTMLElement) =>
    [...folded(host)!.querySelectorAll("[data-place]")].map((place) => place.textContent);
  // The game's own rule over a board where only two players cleared a site.
  const twoHolders = () =>
    seasonPodium({
      prize: { pool: "300", top_n: 3, count: null, awards: [] },
      entries: [
        { address: "Realm 1", sites_cleared: { total: 5, camps: 5, rifts: 0, ruins: 0, beasts: 0 } },
        { address: "Realm 2", sites_cleared: { total: 1, camps: 1, rifts: 0, ruins: 0, beasts: 0 } },
        { address: "Realm 3", sites_cleared: { total: 0, camps: 0, rifts: 0, ruins: 0, beasts: 0 } },
      ],
    })!.map(({ place, lords, holder }) => ({
      place,
      lords,
      holder: typeof holder === "string" ? holder : { name: holder.address },
    }));

  it("stands a desktop's podium of the prizes over the board, second, first and third, each with who holds it or Open", () => {
    const { host, unmount } = sheet(twoHolders(), 1440);
    expect(folded(host)).toBeNull();
    expect(tiles(host)).toEqual(["2100Realm 2", "1150Realm 1", "350Open"]);
    // The board's first three rows wear the podium's medals; the fourth its number.
    expect(
      [...host.querySelectorAll(".ui-table-row")]
        .slice(0, 4)
        .map((row) => row.querySelector("[data-medal]")?.getAttribute("data-medal") ?? null),
    ).toEqual(["1", "2", "3", null]);
    unmount();
  });

  it("folds a phone's podium into one line, first place first, which a press opens and another folds", () => {
    const { host, unmount } = sheet(twoHolders(), 390);
    expect(tiles(host)).toEqual([]);
    expect(folded(host)!.getAttribute("aria-expanded")).toBe("false");
    expect(foldedPlaces(host)).toEqual(["1150Realm 1", "2100Realm 2", "350Open"]);

    act(() => folded(host)!.click());
    expect(folded(host)!.getAttribute("aria-expanded")).toBe("true");
    expect(tiles(host)).toEqual(["2100Realm 2", "1150Realm 1", "350Open"]);

    act(() => folded(host)!.click());
    expect(tiles(host)).toEqual([]);
    unmount();
  });

  it.each([390, 1440])(
    "scrolls the season's end and its prizes away with every realm at %i px, the columns' names staying on top and the player's own row waiting at the foot",
    (width) => {
      const { host, unmount } = sheet(twoHolders(), width);
      const scroll = host.querySelector(".overflow-y-auto")!;
      expect(scroll.textContent).toContain("Season ends");
      expect(scroll.querySelector('[aria-label="Season prizes"]')).not.toBeNull();
      // The columns' head stands in the board's own scroll, after the prizes and before the rows: the kit's table head
      // sticks to the top of the scroll it is in (a browser measures it there: prove:app phone, season-board).
      const parts = [...scroll.children];
      const head = scroll.querySelector(":scope > .ui-table-head")!;
      expect(parts.indexOf(head)).toBeGreaterThan(
        parts.findIndex((part) => part.matches('[aria-label="Season prizes"], :has(> [aria-label="Season prizes"])')),
      );
      expect(parts.indexOf(head)).toBeLessThan(parts.findIndex((part) => part.matches(".ui-table-row")));
      expect([...scroll.querySelectorAll(".ui-table-row")].map((row) => row.getAttribute("aria-label"))).toEqual([
        "#1 Realm 1",
        "#2 Realm 2",
        "#3 Realm 3",
        "#4 Realm 4",
        "#12 Realm 12",
        "#13 Realm 13",
        "#14 Realm 14",
      ]);
      // The player's row stands in its place in the same scroll, the one row the stylesheet holds at the foot.
      expect([...scroll.querySelectorAll(".ui-table-row[data-own]")].map((row) => row.ariaLabel)).toEqual([
        "#12 Realm 12",
      ]);
      expect(host.querySelectorAll(".ui-table-row")).toHaveLength(7);
      unmount();
    },
  );

  it.each([390, 1440])(
    "says no prize pool is published yet at %i px, its medals standing with no amount, and stands nothing once no place is paid",
    (width) => {
      const unpublished = sheet(null, width);
      if (width < 1024) {
        expect(foldedPlaces(unpublished.host)).toEqual(["1—", "2—", "3—"]);
        act(() => folded(unpublished.host)!.click());
      }
      expect(tiles(unpublished.host)).toEqual(["2—", "1—", "3—"]);
      expect(unpublished.host.querySelector('ol[aria-label="Season prizes"]')!.textContent).toContain(
        "Pool not published yet",
      );
      unpublished.unmount();
      const none = sheet([], width);
      expect(none.host.querySelector('[aria-label="Season prizes"]')).toBeNull();
      none.unmount();
    },
  );
});
