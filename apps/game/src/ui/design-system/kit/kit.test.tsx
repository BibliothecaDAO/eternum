import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClockLine } from "./clock-line";
import { clockLineText } from "./clock-text";
import { DayDial } from "./day-dial";
import { ListRow } from "./list-row";
import { Pill } from "./pill";
import { Portrait } from "./portrait";
import { shortfallLine } from "./reasons";
import { SeasonRow } from "./season-row";
import { OpenedFromPanel } from "./opened-from-panel";
import { Sheet } from "./sheet";
import { StoreBar } from "./store-bar";
import { TierChip } from "./tier-chip";

const text = (markup: string) => new DOMParser().parseFromString(markup, "text/html").body.textContent ?? "";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the clock", () => {
  it("says when today ends, the time left and tomorrow's length, and dashes what it does not know", () => {
    const endsAt = new Date(2026, 9, 7, 21, 40).getTime() / 1000;
    const line = text(
      renderToStaticMarkup(
        <ClockLine endsAt={endsAt} secondsLeft={7 * 3600 + 14 * 60} tomorrowSeconds={12 * 3600} tone="calm" />,
      ),
    );
    expect(line).toBe("Day ends21:40·7h 14mleft·Tomorrow lasts12h");
    const unknown = text(
      renderToStaticMarkup(
        <ClockLine endsAt={undefined} secondsLeft={undefined} tomorrowSeconds={undefined} tone="calm" />,
      ),
    );
    expect(unknown).toBe("Day ends—·—left·Tomorrow lasts—");
  });

  it("draws the day in its dial, a dash before the day is known", () => {
    expect(renderToStaticMarkup(<DayDial day={12} shareLeft={0.4} tone="calm" />)).toContain('aria-label="Day 12"');
    expect(text(renderToStaticMarkup(<DayDial day={undefined} shareLeft={undefined} tone="calm" />))).toBe("—");
  });
});

describe("stores and prices", () => {
  it("fills a store bar to its share of the limit, and keeps the room empty for a store with no limit", () => {
    expect(renderToStaticMarkup(<StoreBar amount={9_000} limit={18_000} tone="calm" />)).toContain("width:50%");
    expect(renderToStaticMarkup(<StoreBar amount={20_000} limit={18_000} tone="ember" />)).toContain("width:100%");
    expect(renderToStaticMarkup(<StoreBar amount={undefined} limit={18_000} tone="calm" />)).toContain("width:0%");
    expect(renderToStaticMarkup(<StoreBar amount={5} tone="calm" />)).not.toContain("meter");
  });
});

describe("a shortfall's line", () => {
  it("names what is counted, with the exact wait", () => {
    expect(shortfallLine({ kind: "short", of: "labor", held: 9_640, need: 15_000, wait: 10 * 3600 + 44 * 60 })).toBe(
      "Needs 15K labor, have 9,640 · in 10h 44m",
    );
  });

  it("counts what is free, or a store's own limit, in the same line", () => {
    expect(shortfallLine({ kind: "short", of: "population", counted: "free", held: 2, need: 3 })).toBe(
      "Needs 3 population, 2 free",
    );
    expect(shortfallLine({ kind: "short", of: "labor", counted: "limit", held: 18_000, need: 24_000 })).toBe(
      "Needs 24K labor, the store holds 18K",
    );
    expect(shortfallLine({ kind: "short", of: "essence", held: undefined, need: 48_000 })).toBe(
      "Needs 48K Essence, have —",
    );
  });

  it("never reads a shortfall as met where both sides round alike", () => {
    const line = (held: number, need: number) => shortfallLine({ kind: "short", of: "labor", held, need });
    expect(line(28.1, 28.15)).toBe("Needs 28.2 labor, have 28.1");
    expect(line(12_440, 12_449)).toBe("Needs 12,449 labor, have 12,440");
    expect(line(0.555, 0.556)).toBe("Needs 0.556 labor, have 0.555");
  });

  it("names what failed in one line", () => {
    expect(shortfallLine({ kind: "failed", line: "Season did not answer." })).toBe("Season did not answer.");
  });
});

describe("Pill", () => {
  it("says one fact with its icon, or leads with the sage dot for a game under way", () => {
    const closed = renderToStaticMarkup(<Pill icon="lock">Closed</Pill>);
    expect(text(closed)).toBe("Closed");
    expect(closed).toContain('data-icon="lock"');
    const live = renderToStaticMarkup(<Pill tone="live">Live</Pill>);
    expect(live).toContain("bg-kit-sage");
    expect(live).not.toContain("data-icon");
  });

  it("runs its step when it is a button, and crosses out the icon of a prize that does not come", () => {
    const onClick = vi.fn();
    act(() =>
      root.render(
        <Pill as="button" size="lg" tone="muted" icon="refresh" onClick={onClick}>
          Another wallet
        </Pill>,
      ),
    );
    act(() => host.querySelector("button")!.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(
      renderToStaticMarkup(
        <Pill size="lg" tone="muted" icon="lords" struck>
          No LORDS
        </Pill>,
      ),
    ).toContain("bg-kit-red");
  });
});

describe("Portrait", () => {
  it("shows the chosen portrait, else the account's stock one, and a dash for a player not named", () => {
    const chosen = renderToStaticMarkup(<Portrait account="0x1" portrait="04" size={28} weight={1.5} />);
    expect(chosen).toContain('src="/images/avatars/04.png"');
    expect(renderToStaticMarkup(<Portrait account="0x1" size={28} weight={1.5} />)).toMatch(
      /src="\/images\/avatars\/[^"]+\.png"/,
    );
    expect(renderToStaticMarkup(<Portrait portrait="04" size={24} weight={2} />)).toContain("width:24px");
    expect(text(renderToStaticMarkup(<Portrait.Empty />))).toBe("—");
  });
});

describe("ListRow", () => {
  it("taps as a whole when it opens something, and only shows otherwise", () => {
    const onClick = vi.fn();
    act(() => root.render(<ListRow onClick={onClick} title="Settings" chevron />));
    const button = host.querySelector("button");
    expect(button?.getAttribute("type")).toBe("button");
    expect(button?.textContent).toBe("Settings");
    expect(button?.querySelector('[data-icon="chevron-right"]')).not.toBeNull();
    act(() => button?.click());
    expect(onClick).toHaveBeenCalledOnce();
    const shown = renderToStaticMarkup(<ListRow title="Music" trailing={<input />} />);
    expect(shown).toMatch(/^<div /);
  });

  it("in a list, the item holds the row's hook and the link inside it the tap", () => {
    const item = renderToStaticMarkup(
      <MemoryRouter>
        <ul>
          <ListRow as="li" to="/results/1" title="Blitz 15:00" line={<span>7 Oct</span>} />
          <ListRow as="li" data-play-item="blitz-1" title="Blitz 1630" />
        </ul>
      </MemoryRouter>,
    );
    expect(item).toMatch(/<li [^>]*><a [^>]*href="\/results\/1"/);
    expect(item).toMatch(/<li [^>]*data-play-item="blitz-1"/);
  });

  it("opens another site in a new tab, and says the reader's own row", () => {
    const link = renderToStaticMarkup(<ListRow href="https://realms.world" current title="Guide" />);
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(link).toContain('aria-current="true"');
  });
});

describe("TierChip", () => {
  it("draws the tier's pips and its word alone, or the pips without the word where there is no room", () => {
    const rare = renderToStaticMarkup(<TierChip tier={3} showWord />);
    expect(text(rare)).toBe("Rare");
    expect(rare).toContain('aria-label="Rare"');
    expect(text(renderToStaticMarkup(<TierChip tier={5} showWord={false} />))).toBe("");
  });
});

describe("SeasonRow", () => {
  it("shows rank, name, sites cleared and LORDS, dashes the unknown, and marks the player's own row", () => {
    const onOpen = vi.fn();
    act(() =>
      root.render(<SeasonRow rank={12} order={1} name="You" sitesCleared={88} lords={undefined} own onOpen={onOpen} />),
    );
    const row = host.querySelector("button")!;
    expect(row.textContent).toBe("12You88—");
    expect(row.getAttribute("aria-current")).toBe("true");
    act(() => row.click());
    expect(onOpen).toHaveBeenCalled();
  });
});

describe("Sheet", () => {
  const renderSheet = (onClose: () => void) =>
    act(() =>
      root.render(
        <Sheet label="Deploy" onClose={onClose}>
          <p>rows</p>
        </Sheet>,
      ),
    );

  it("closes from its handle, a tap on the stage and Escape", () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    act(() => host.querySelector<HTMLButtonElement>("button[aria-hidden]")!.click());
    act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("takes the Escape that closes it, so the same press backs out of nothing else", () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => void document.body.dispatchEvent(escape));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(escape.defaultPrevented).toBe(true);
  });

  it("on a desktop closes from its own mark: a cross, or a back arrow when it opened from another panel", () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    expect(host.querySelectorAll('button[aria-label="Close"]')).toHaveLength(2);
    expect(host.querySelector('button[aria-label="Back"]')).toBeNull();
    act(() =>
      root.render(
        <OpenedFromPanel.Provider value>
          <Sheet label="Farm" onClose={onClose}>
            <p>rows</p>
          </Sheet>
        </OpenedFromPanel.Provider>,
      ),
    );
    expect(host.querySelectorAll('button[aria-label="Close"]')).toHaveLength(1);
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on the system back, which leaves the page under it where it was", () => {
    const onClose = vi.fn();
    const before = window.history.length;
    renderSheet(onClose);
    expect(window.history.length).toBe(before + 1);
    act(() => {
      window.history.replaceState(null, "");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("a Sheet closed in the tick it opened", () => {
  it("steps back off its history entry once, even under React's double mount", () => {
    vi.useFakeTimers();
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    act(() =>
      root.render(
        <StrictMode>
          <Sheet label="Deploy" onClose={() => {}}>
            <p>rows</p>
          </Sheet>
        </StrictMode>,
      ),
    );
    act(() => root.render(<StrictMode>{null}</StrictMode>));
    vi.runAllTimers();
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
    vi.useRealTimers();
    window.history.replaceState(null, "");
  });
});

describe("the clock line as text", () => {
  it("writes the Day-end reminder's line from its instants with the clock line's words", () => {
    const endsAt = new Date(2026, 9, 7, 21, 40).getTime() / 1000;
    expect(clockLineText({ endsAt, secondsLeft: 3_600, tomorrowSeconds: 12 * 3_600 })).toBe(
      "Day ends 21:40 · 1h left · Tomorrow lasts 12h",
    );
    expect(clockLineText({ endsAt: undefined, secondsLeft: undefined, tomorrowSeconds: undefined })).toBe(
      "Day ends — · — left · Tomorrow lasts —",
    );
  });
});
