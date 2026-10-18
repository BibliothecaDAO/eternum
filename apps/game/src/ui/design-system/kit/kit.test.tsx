import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { ClockLine } from "./clock-line";
import { clockLineText } from "./clock-text";
import { DayDial } from "./day-dial";
import { Confirm } from "./confirm";
import { Field } from "./field";
import { Figure } from "./figure";
import { ListRow } from "./list-row";
import { Notice } from "./notice";
import { PaintedCard } from "./painted-card";
import { Panel, PanelTitle } from "./panel";
import { Pill } from "./pill";
import { Portrait } from "./portrait";
import { ReasonPlate } from "./reason-plate";
import { shortfallLine } from "./reasons";
import { SeasonRow } from "./season-row";
import { SectionLabel } from "./section-label";
import { SettingRow } from "./setting-row";
import { OpenedFromPanel } from "./opened-from-panel";
import { Sheet } from "./sheet";
import { FailureCard, StateCard } from "./state-card";
import { StoreBar } from "./store-bar";
import { TierChip } from "./tier-chip";
import { Title } from "./title";
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

describe("Button", () => {
  it("runs its verb, and while the action is under way shows the step's word and takes no second tap", () => {
    const onClick = vi.fn();
    act(() => root.render(<Button role="primary" word="Deploy" onClick={onClick} />));
    const button = host.querySelector("button")!;
    expect(button.textContent).toBe("Deploy");
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

describe("ViewSwitch as tabs", () => {
  it("is a tab list with the shown view selected, and dots only an unshown view that holds the player's own", () => {
    const onChange = vi.fn();
    const views = [
      { id: "blitz", word: "Blitz" },
      { id: "eternum", word: "Eternum" },
    ] as const;
    act(() =>
      root.render(
        <ViewSwitch
          label="Modes"
          variant="split"
          semantics="tab"
          views={[...views]}
          lit="blitz"
          onChange={onChange}
          marked={["blitz", "eternum"]}
          markWord="Yours"
        />,
      ),
    );
    expect(host.querySelector('[role="tablist"]')?.getAttribute("aria-label")).toBe("Modes");
    const [blitz, eternum] = host.querySelectorAll('[role="tab"]');
    expect(blitz.getAttribute("aria-selected")).toBe("true");
    expect(blitz.hasAttribute("aria-checked")).toBe(false);
    expect(blitz.querySelector('[aria-label="Yours"]')).toBeNull();
    expect(eternum.querySelector('[aria-label="Yours"]')).not.toBeNull();
    act(() => (eternum as HTMLButtonElement).click());
    expect(onChange).toHaveBeenCalledWith("eternum");
  });
});

describe("SectionLabel", () => {
  it("heads a group in its words", () => {
    expect(renderToStaticMarkup(<SectionLabel>Now</SectionLabel>)).toMatch(/^<h2 [^>]*>Now<\/h2>$/);
  });
});

describe("Title", () => {
  it("is the element the page's outline needs, in its words", () => {
    expect(renderToStaticMarkup(<Title level="page">Season 3</Title>)).toMatch(/^<h1 [^>]*>Season 3<\/h1>$/);
    expect(
      renderToStaticMarkup(
        <Title level="countdown" as="span">
          0:59:12
        </Title>,
      ),
    ).toMatch(/^<span [^>]*>0:59:12<\/span>$/);
  });

  it("takes a site's own size in place of its level's, never both", () => {
    const name = renderToStaticMarkup(
      <Title level="plate" as="h2" className="text-[30px] leading-none">
        Ysabeau
      </Title>,
    );
    expect(name).toContain("text-[30px]");
    expect(name).toContain("leading-none");
    expect(name).not.toContain("text-[34px]");
    expect(name).not.toContain("leading-tight");
  });
});

describe("Figure", () => {
  it("draws a bold figure in tabular numerals, and an extrabold one in proportional numerals", () => {
    const bold = renderToStaticMarkup(<Figure size="title">1,840</Figure>);
    expect(bold).toMatch(/^<b [^>]*>1,840<\/b>$/);
    expect(bold).toContain("tabular-nums");
    expect(
      renderToStaticMarkup(
        <Figure size="figure" weight="extrabold">
          #12
        </Figure>,
      ),
    ).not.toContain("tabular-nums");
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

describe("PaintedCard", () => {
  it("lays its words over its painting, and keeps the hook a page names it by", () => {
    const card = renderToStaticMarkup(
      <PaintedCard data-play-item="blitz-1" painting="blitz-spires" sizes="100vw" grade="side">
        <h2>Blitz 1630</h2>
      </PaintedCard>,
    );
    expect(card).toMatch(/^<section [^>]*data-play-item="blitz-1"/);
    expect(card).toContain('src="/images/landscapes/blitz-spires-800.webp"');
    expect(text(card)).toBe("Blitz 1630");
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

describe("SettingRow", () => {
  it("is a button that opens, a link to another site, or a row with its own control and no chevron", () => {
    const opens = renderToStaticMarkup(<SettingRow icon="person" name="Settings" onOpen={() => undefined} />);
    expect(opens).toMatch(/^<button type="button"/);
    expect(opens).toContain('data-icon="chevron-right"');
    expect(renderToStaticMarkup(<SettingRow icon="guide" name="Guide" href="https://realms.world" />)).toMatch(/^<a /);
    const control = renderToStaticMarkup(
      <SettingRow icon="music" name="Music" end={<b>on</b>} onOpen={() => undefined} />,
    );
    expect(control).toMatch(/^<div /);
    expect(control).not.toContain('data-icon="chevron-right"');
    expect(text(control)).toBe("Musicon");
  });
});

describe("Confirm", () => {
  it("asks first, with Keep as the safe step and the destructive verb after it", () => {
    const onConfirm = vi.fn();
    const onKeep = vi.fn();
    act(() =>
      root.render(
        <MemoryRouter>
          <Confirm
            question="Remove this device?"
            cost="It forgets its key."
            verb="Remove"
            onConfirm={onConfirm}
            onKeep={onKeep}
          />
        </MemoryRouter>,
      ),
    );
    const buttons = [...document.querySelectorAll("button")].map((button) => button.textContent);
    expect(buttons.indexOf("Keep")).toBeLessThan(buttons.indexOf("Remove"));
    act(() => [...document.querySelectorAll("button")].find((button) => button.textContent === "Remove")?.click());
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("Panel", () => {
  it("titles its rows with its icon and words, a figure at the title's end", () => {
    const panel = renderToStaticMarkup(
      <Panel icon="crown" title="Frontier" aside={<b>12th</b>}>
        <p>rows</p>
      </Panel>,
    );
    expect(text(panel)).toBe("Frontier12throws");
    expect(panel).toContain('data-icon="crown"');
    expect(
      renderToStaticMarkup(
        <PanelTitle rule="line" icon="backpack">
          Payout wallet
        </PanelTitle>,
      ),
    ).toContain("border-b");
  });
});

describe("StateCard", () => {
  it("shows its painting over one line, and a failed read as the storm with the service's line and Try again", () => {
    const card = renderToStaticMarkup(
      <StateCard painting="brooding-plains" sizes="50vw">
        <p>No season running</p>
      </StateCard>,
    );
    expect(card).toContain("brooding-plains-800.webp");
    expect(card).toContain('sizes="50vw"');
    const retry = vi.fn();
    act(() => root.render(<FailureCard service="season" error={new Error("down")} retry={retry} />));
    expect(host.querySelector("img")?.getAttribute("src")).toContain("stormy");
    expect(host.textContent).toContain("Season did not answer.");
    act(() => host.querySelector("button")!.click());
    expect(retry).toHaveBeenCalled();
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
