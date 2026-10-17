import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatAmount, formatExact } from "./amount";
import { Button } from "./button";
import { ClockLine } from "./clock-line";
import { clockLineText } from "./clock-text";
import { DayDial } from "./day-dial";
import { Field } from "./field";
import { Notice } from "./notice";
import { PriceChip } from "./price-chip";
import { ReasonPlate, shortfallLine } from "./reason-plate";
import { SeasonRow } from "./season-row";
import { OpenedFromPanel } from "./opened-from-panel";
import { Sheet } from "./sheet";
import { StoreBar } from "./store-bar";
import { TierChip } from "./tier-chip";
import { formatClockTime, formatDuration, formatMoment } from "./time";
import { ViewSwitch } from "./view-switch";

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

describe("amounts", () => {
  it("shows an unknown amount as a dash, never zero, and compacts past ten thousand", () => {
    expect(formatAmount(undefined)).toBe("—");
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(1_498)).toBe("1,498");
    expect(formatAmount(12_400)).toBe("12.4K");
  });

  it("keeps a price exact at any size", () => {
    expect(formatExact(24_000)).toBe("24,000");
    expect(formatExact(undefined)).toBe("—");
  });
});

describe("time", () => {
  it("writes durations in hours and minutes, never days, rounding up so time left never reads 0m", () => {
    expect(formatDuration(7 * 3600 + 14 * 60)).toBe("7h 14m");
    expect(formatDuration(12 * 3600)).toBe("12h");
    expect(formatDuration(42 * 60)).toBe("42m");
    expect(formatDuration(30 * 3600)).toBe("30h");
    expect(formatDuration(1)).toBe("1m");
    expect(formatDuration(undefined)).toBe("—");
  });

  it("writes a moment as the local clock time, unknown as a dash", () => {
    const at = new Date(2026, 9, 7, 21, 40).getTime() / 1000;
    expect(formatClockTime(at)).toBe("21:40");
    expect(formatClockTime(undefined)).toBe("—");
  });

  it("writes a moment a day away with its day, so a clock time already gone today never reads as past", () => {
    const now = new Date(2026, 9, 10, 15, 0).getTime() / 1000;
    expect(formatMoment(new Date(2026, 9, 11, 14, 32).getTime() / 1000, now)).toBe("11 Oct 14:32");
    expect(formatMoment(undefined, now)).toBe("—");
  });
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

  it("prices in a resource by its icon and in XP by its word; an unknown price is a dash", () => {
    expect(renderToStaticMarkup(<PriceChip of="wheat" amount={10_000} />)).toContain('aria-label="10,000 wheat"');
    expect(text(renderToStaticMarkup(<PriceChip of="xp" amount={400} />))).toBe("400XP");
    expect(text(renderToStaticMarkup(<PriceChip of="lords" amount={undefined} />))).toBe("—");
  });
});

describe("Button", () => {
  it("runs its verb, and while the action is under way shows the step's word and takes no second tap", () => {
    const onClick = vi.fn();
    act(() =>
      root.render(<Button role="primary" word="Deploy" prices={[{ of: "wheat", amount: 10_000 }]} onClick={onClick} />),
    );
    const button = host.querySelector("button")!;
    expect(button.textContent).toBe("Deploy10,000");
    act(() => button.click());
    expect(onClick).toHaveBeenCalledTimes(1);

    act(() => root.render(<Button role="primary" word="Deploy" loading="Deploying…" onClick={onClick} />));
    expect(button.textContent).toBe("Deploying…");
    expect(button.disabled).toBe(true);
    act(() => button.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("given a route, leads there after its verb has run", () => {
    const order: string[] = [];
    const Here = () => {
      order.push(`at ${useLocation().pathname}`);
      return null;
    };
    act(() =>
      root.render(
        <MemoryRouter initialEntries={["/nowhere"]}>
          <Button role="primary" word="Play" to="/" onClick={() => order.push("verb")} />
          <Here />
        </MemoryRouter>,
      ),
    );
    act(() => host.querySelector("button")!.click());
    expect(order).toEqual(["at /nowhere", "verb", "at /"]);
  });
});

describe("Field", () => {
  const field = () => host.querySelector("label")!;
  it("is one box around its input, and says when the player's entry is refused", () => {
    act(() => root.render(<Field size="lg" icon="mail" aria-label="Email" />));
    expect(field().querySelector("input")!.getAttribute("aria-label")).toBe("Email");
    expect(field().querySelector("input")!.hasAttribute("aria-invalid")).toBe(false);
    expect(field().className).toContain("focus-within:border-kit-peach");

    act(() => root.render(<Field size="lg" invalid aria-label="Name" />));
    expect(field().querySelector("input")!.getAttribute("aria-invalid")).toBe("true");
    expect(field().className).toContain("border-kit-red");
    expect(field().className).not.toContain("focus-within:");
  });

  it("ticks a valid entry and keeps a trailing control inside the box", () => {
    act(() => root.render(<Field size="md" valid aria-label="Message" trailing={<kbd>Enter</kbd>} />));
    expect(field().className).toContain("border-kit-peach");
    expect(field().querySelectorAll("img, svg").length).toBeGreaterThan(0);
    expect(field().querySelector("kbd")?.textContent).toBe("Enter");
  });
});

describe("ReasonPlate", () => {
  it("says a shortfall in one line that names what is counted, with the exact wait, and the step beside it", () => {
    const plate = text(
      renderToStaticMarkup(
        <ReasonPlate
          reason={{ kind: "short", of: "labor", held: 9_640, need: 15_000, wait: 10 * 3600 + 44 * 60 }}
          step={<Button role="primary" word="Map" />}
        />,
      ),
    );
    expect(plate).toBe("Needs 15,000 labor, have 9,640 · in 10h 44mMap");
  });

  it("counts what is free, or a store's own limit, in the same line", () => {
    expect(shortfallLine({ kind: "short", of: "population", counted: "free", held: 2, need: 3 })).toBe(
      "Needs 3 population, 2 free",
    );
    expect(shortfallLine({ kind: "short", of: "labor", counted: "limit", held: 18_000, need: 24_000 })).toBe(
      "Needs 24,000 labor, the store holds 18,000",
    );
    expect(shortfallLine({ kind: "short", of: "essence", held: undefined, need: 48_000 })).toBe(
      "Needs 48,000 Essence, have —",
    );
  });

  it("names what failed in one line", () => {
    const plate = text(
      renderToStaticMarkup(<ReasonPlate reason={{ kind: "failed", line: "Season did not answer." }} />),
    );
    expect(plate).toBe("Season did not answer.");
  });
});

describe("Notice", () => {
  it("runs its verb, and offers Later only when it can be put off", () => {
    const onVerb = vi.fn();
    const onLater = vi.fn();
    act(() => root.render(<Notice icon="network-off" line="Offline" verb="Try again" onVerb={onVerb} ember />));
    expect(host.querySelectorAll("button")).toHaveLength(1);
    act(() => host.querySelector("button")!.click());
    expect(onVerb).toHaveBeenCalled();

    act(() =>
      root.render(<Notice icon="network-off" line="Update ready" verb="Update" onVerb={onVerb} onLater={onLater} />),
    );
    act(() => host.querySelector("button")!.click());
    expect(onLater).toHaveBeenCalled();
  });
});

describe("ViewSwitch", () => {
  it("lights one view and switches only to another", () => {
    const onChange = vi.fn();
    const views = [
      { id: "season", word: "Season" },
      { id: "history", word: "History" },
    ] as const;
    act(() => root.render(<ViewSwitch label="Season" views={[...views]} lit="season" onChange={onChange} />));
    const [season, history] = host.querySelectorAll("button");
    expect(season.getAttribute("aria-checked")).toBe("true");
    act(() => season.click());
    expect(onChange).not.toHaveBeenCalled();
    act(() => history.click());
    expect(onChange).toHaveBeenCalledWith("history");
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
