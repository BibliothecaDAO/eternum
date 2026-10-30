import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { SeasonDetailSheet } from "./season-detail";
import { SeasonList, type SeasonListRow } from "./season-list";
import { seasonPodium } from "./season-pool";
import { SeasonOverCard } from "./season-over-card";
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
  it("names its columns, lists the realms, pins the player's own row under them and opens a row, with no Back", () => {
    const onOpen = vi.fn();
    const { host, unmount } = render(
      <SeasonList
        rank={12}
        rows={[row(1), row(2)]}
        pinned={row(12, true)}
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
    ).toEqual(["Sites cleared", "LORDS earned"]);
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
      <SeasonList
        rank={1}
        rows={[row(1, true)]}
        pinned={undefined}
        state="ready"
        onRetry={vi.fn()}
        onOpen={vi.fn()}
        onClose={onClose}
      />,
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
        pinned={undefined}
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
      <SeasonList
        rank={undefined}
        rows={[]}
        pinned={undefined}
        state="failed"
        onRetry={onRetry}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
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

  it("details a realm's season by kind and its Depth once it has one, with Visit for another realm and none for the player's own", () => {
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
    // Depth 0 is not drawn: no realm has gone through yet.
    expect(other.host.querySelector("[aria-label^='Depth']")).toBeNull();
    act(() => button(other.host, "Visit").click());
    expect(onVisit).toHaveBeenCalled();
    other.unmount();
    const own = render(<SeasonDetailSheet detail={{ ...detail, depth: 2 }} label="You" onClose={vi.fn()} />);
    expect(own.host.querySelector("[aria-label='Depth II']")).not.toBeNull();
    expect(button(own.host, "Visit")).toBeUndefined();
    own.unmount();
  });
});

describe("the season's prizes in game", () => {
  const sheet = (podium: Parameters<typeof SeasonList>[0]["podium"]) =>
    render(
      <SeasonList
        rank={2}
        podium={podium}
        rows={[row(1), row(2), row(3), row(4)]}
        pinned={undefined}
        state="ready"
        onRetry={vi.fn()}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
  const tiles = (host: HTMLElement) =>
    [...host.querySelectorAll('[aria-label="Season prizes"] li[data-place]')].map((tile) => tile.textContent);

  it("stands a podium of the prizes over the board, second, first and third, each with who holds it or Open", () => {
    // The game's own rule over a board where only two players cleared a site.
    const podium = seasonPodium({
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
    const { host, unmount } = sheet(podium);
    expect(tiles(host)).toEqual(["2100Realm 2", "1150Realm 1", "350Open"]);
    // The board's first three rows wear the podium's medals; the fourth its number.
    expect(
      [...host.querySelectorAll(".ui-table-row")].map(
        (row) => row.querySelector("[data-medal]")?.getAttribute("data-medal") ?? null,
      ),
    ).toEqual(["1", "2", "3", null]);
    unmount();
  });

  it("says no prize pool is published yet, its medals standing with no amount, and stands nothing once no place is paid", () => {
    const unpublished = sheet(null);
    expect(tiles(unpublished.host)).toEqual(["2—", "1—", "3—"]);
    expect(unpublished.host.querySelector('[aria-label="Season prizes"]')!.textContent).toContain(
      "Pool not published yet",
    );
    unpublished.unmount();
    const none = sheet([]);
    expect(none.host.querySelector('[aria-label="Season prizes"]')).toBeNull();
    none.unmount();
  });
});

describe("the season's end", () => {
  it("tells the ending, the place of the field, the podium and the season's totals with its Depth, with Season and Exit", () => {
    const onSeason = vi.fn();
    const onExit = vi.fn();
    const { host, unmount } = render(
      <SeasonOverCard
        ending="strong"
        place={12}
        field={1_000}
        podium={[
          { key: "a", rank: 1, name: "Ysabeau", sitesCleared: 448 },
          { key: "b", rank: 2, name: "Aldric", sitesCleared: 412 },
        ]}
        totals={{ sitesCleared: 288, chests: 61, lords: 2_003, depth: 2, essence: 2_100_000, labor: 1_400_000 }}
        onSeason={onSeason}
        onExit={onExit}
      />,
    );
    expect(host.textContent).toContain("The mist grew too strong");
    expect(host.textContent).toContain("You placed");
    expect(host.textContent).toContain("#12");
    expect(host.textContent).toContain("1,000");
    expect(host.querySelector("[aria-label='Depth II']")).not.toBeNull();
    const podium = [...host.querySelectorAll("ol li")].map((place) => place.textContent);
    expect(podium[0]).toContain("Aldric");
    expect(podium[1]).toContain("Ysabeau");
    act(() => button(host, "Season").click());
    act(() => button(host, "Exit").click());
    expect(onSeason).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalled();
    unmount();
  });

  it("leaves Depth out of the totals of a realm that never went through the spire", () => {
    const { host, unmount } = render(
      <SeasonOverCard
        ending="lifted"
        place={40}
        field={1_000}
        podium={[]}
        totals={{ sitesCleared: 12, chests: 1, lords: 20, depth: 0, essence: 9_000, labor: 4_000 }}
        onSeason={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    expect(host.textContent).not.toContain("Depth");
    expect(host.querySelectorAll("[data-total]")).toHaveLength(5);
    unmount();
  });
});
