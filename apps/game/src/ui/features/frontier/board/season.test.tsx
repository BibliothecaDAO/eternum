import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { SeasonDetailSheet } from "./season-detail";
import { SeasonList, type SeasonListRow } from "./season-list";
import { SeasonOverCard } from "./season-over-card";

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
  name: `Realm ${rank}`,
  sitesCleared: 100 - rank,
  lords: 50,
  own,
});

const button = (host: HTMLElement, word: string) =>
  [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === word)!;

describe("the season list", () => {
  it("lists the realms, pins the player's own row under them, opens a row and goes back", () => {
    const onOpen = vi.fn();
    const onBack = vi.fn();
    const { host, unmount } = render(
      <SeasonList
        rank={12}
        rows={[row(1), row(2)]}
        pinned={row(12, true)}
        state="ready"
        onRetry={vi.fn()}
        onOpen={onOpen}
        onBack={onBack}
      />,
    );
    const own = host.querySelector("button[aria-current='true']")!;
    expect(own.textContent).toContain("Realm 12");
    expect(host.querySelector("[aria-label='Season #12']")).not.toBeNull();
    act(() =>
      [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("Realm 2"))!.click(),
    );
    expect(onOpen).toHaveBeenCalledWith("realm-2");
    act(() => host.querySelector<HTMLButtonElement>("button[aria-label='Back']")!.click());
    expect(onBack).toHaveBeenCalled();
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
        onBack={vi.fn()}
      />,
    );
    expect(host.textContent).toContain("Season did not answer.");
    expect(host.querySelector("[aria-label='Season —']")).not.toBeNull();
    act(() => button(host, "Try again").click());
    expect(onRetry).toHaveBeenCalled();
    unmount();
  });

  it("details a realm's season by kind, with Visit for another realm and none for the player's own", () => {
    const detail = {
      rank: 2,
      order: 2,
      name: "Aldric",
      sites: { total: 132, camps: 70, rifts: 43, ruins: 9, stragglers: 10 },
      chests: 9,
      lords: 640,
      reach: 0,
      essence: 212_000,
      labor: 96_000,
    };
    const onVisit = vi.fn();
    const other = render(<SeasonDetailSheet detail={detail} label="Aldric" onVisit={onVisit} onClose={vi.fn()} />);
    expect(other.host.querySelector("[aria-label='Ruin 9']")).not.toBeNull();
    expect(other.host.querySelector("[aria-label='Ethereal —']")).not.toBeNull();
    act(() => button(other.host, "Visit").click());
    expect(onVisit).toHaveBeenCalled();
    other.unmount();
    const own = render(<SeasonDetailSheet detail={detail} label="You" onClose={vi.fn()} />);
    expect(button(own.host, "Visit")).toBeUndefined();
    own.unmount();
  });
});

describe("the season's end", () => {
  it("tells the ending, the place of the field, the podium and the season's totals, with Season and Exit", () => {
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
        totals={{ sitesCleared: 288, chests: 61, lords: 2_003, reach: 2, essence: 2_100_000, labor: 1_400_000 }}
        onSeason={onSeason}
        onExit={onExit}
      />,
    );
    expect(host.textContent).toContain("The mist grew too strong");
    expect(host.textContent).toContain("You placed");
    expect(host.textContent).toContain("#12");
    expect(host.textContent).toContain("1,000");
    expect(host.textContent).toContain("II");
    const podium = [...host.querySelectorAll("ol li")].map((place) => place.textContent);
    expect(podium[0]).toContain("Aldric");
    expect(podium[1]).toContain("Ysabeau");
    act(() => button(host, "Season").click());
    act(() => button(host, "Exit").click());
    expect(onSeason).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalled();
    unmount();
  });
});
