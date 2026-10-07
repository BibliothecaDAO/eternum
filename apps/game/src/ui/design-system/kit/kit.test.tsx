import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatAmount, formatExact } from "./amount";
import { Button } from "./button";
import { ClockLine } from "./clock-line";
import { clockLineText } from "./clock-text";
import { DayDial } from "./day-dial";
import { Notice } from "./notice";
import { PriceChip } from "./price-chip";
import { ReasonPlate } from "./reason-plate";
import { SeasonRow } from "./season-row";
import { Sheet } from "./sheet";
import { StoreBar } from "./store-bar";
import { TierChip } from "./tier-chip";
import { formatClockTime, formatDuration } from "./time";
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
});

describe("ReasonPlate", () => {
  it("holds what the player has against the price, with the exact wait, and the step beside it", () => {
    const plate = text(
      renderToStaticMarkup(
        <ReasonPlate
          reason={{ kind: "short", icon: "La", held: 9_640, need: 15_000, wait: 10 * 3600 + 44 * 60 }}
          step={<Button role="primary" word="Map" />}
        />,
      ),
    );
    expect(plate).toBe("9,640 / 15,00010h 44mMap");
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
    act(() => root.render(<Notice icon="Of" line="Offline" verb="Try again" onVerb={onVerb} ember />));
    expect(host.querySelectorAll("button")).toHaveLength(1);
    act(() => host.querySelector("button")!.click());
    expect(onVerb).toHaveBeenCalled();

    act(() => root.render(<Notice icon="Of" line="Update ready" verb="Update" onVerb={onVerb} onLater={onLater} />));
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
