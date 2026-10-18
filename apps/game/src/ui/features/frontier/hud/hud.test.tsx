import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { dayOf } from "@bibliothecadao/eternum";

import { canResearchNow } from "../research/research-plan";
import { secondsUntilHeld } from "./army-order";
import { ArmyToken, OpenSlot, xpLine } from "./army-token";
import { useChatKey } from "./chat-key";
import { dayClock } from "./day-clock";
import { HudBands } from "./hud-bands";
import { useHudSurface } from "./frontier-nav";
import { MenuSheet } from "./menu-sheet";
import { OrderBar } from "./order-bar";
import { PlaceNav } from "./place-nav";
import { StatusStrip, type StoreReading, storeLine } from "./status-strip";

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

describe("the day clock", () => {
  const rules = { dayUnitSeconds: 4 * 3_600, seed: 1n, startMainAt: 0 };

  it("counts days from one on the season's calendar, ends today with its day and says how long tomorrow lasts", () => {
    const eleventh = dayOf(rules, 0)!;
    let today = eleventh;
    for (let index = 0; index < 11; index += 1) today = dayOf(rules, today.end)!;
    const now = today.start + 3_600;
    const clock = dayClock(rules, now);
    const tomorrow = dayOf(rules, today.end)!;
    expect(clock.day).toBe(12);
    expect(clock.endsAt).toBe(today.end);
    expect(clock.secondsLeft).toBe(today.end - now);
    expect(clock.tomorrowSeconds).toBe(tomorrow.end - tomorrow.start);
    expect(clock.shareLeft).toBeCloseTo((today.end - now) / (today.end - today.start));
    expect(clock.tone).toBe("calm");
  });

  it("turns ember in the last hour, and knows nothing before the season starts", () => {
    expect(dayClock(rules, dayOf(rules, 0)!.end - 600).tone).toBe("ember");
    const before = dayClock({ ...rules, startMainAt: 10 * 16 * 3_600 }, 3_600);
    expect(before.day).toBeUndefined();
    expect(before.endsAt).toBeUndefined();
  });
});

describe("the status strip", () => {
  it("says a store in one line: what it holds of its limit, its rate an hour and when it is full", () => {
    const wheat: StoreReading = { kind: "wheat", amount: 1_771, limit: 6_000, tone: "calm", flyTarget: "wheat" };
    expect(storeLine({ ...wheat, perHour: 302, fullIn: 14 * 3_600 })).toBe(
      "wheat 1,771 of 6,000 · +302 an hour · Full in 14h",
    );
    expect(storeLine({ ...wheat, amount: 6_000, perHour: 302, fullIn: 0 })).toBe("wheat 6,000 of 6,000 · Full");
    // No building makes it: no rate to say, and no moment it fills.
    expect(storeLine(wheat)).toBe("wheat 1,771 of 6,000");
    // Essence has no limit.
    expect(storeLine({ ...wheat, kind: "essence", amount: 18_250, limit: undefined })).toBe("Essence 18,250");
    expect(storeLine({ ...wheat, amount: undefined })).toBe("wheat — of 6,000");
  });

  const store = (kind: StoreReading["kind"], amount: number | undefined, limit?: number): StoreReading => ({
    kind,
    amount,
    limit,
    tone: "calm",
    flyTarget: `test-${kind}`,
  });

  it("shows each store with a limit bar where it has a limit, and dashes the unknown", () => {
    const clock = dayClock({ dayUnitSeconds: 4 * 3_600, seed: 1n, startMainAt: 0 }, 3_600);
    const markup = renderToStaticMarkup(
      <StatusStrip
        clock={clock}
        stores={[store("essence", 18_250), store("labor", 9_000, 18_000), store("wheat", undefined, 18_000)]}
      />,
    );
    expect(markup.match(/role="meter"/g)).toHaveLength(2);
    expect(markup).toContain("width:50%");
    // Each plate is one image named by its line, so the tooltip and a screen reader say the same words.
    expect(markup).toContain('role="img" aria-label="Essence 18,250"');
    expect(markup).toContain('role="img" aria-label="labor 9,000 of 18,000"');
    expect(markup).toContain('role="img" aria-label="wheat — of 18,000"');
    expect(text(markup)).toContain("—");
    expect(text(markup)).toContain("Tomorrow lasts 16h");
  });
});

describe("the army token", () => {
  it("wears the XP balance as its badge, its stamina in five segments of its own maximum, and its troops", () => {
    const markup = renderToStaticMarkup(
      <ArmyToken
        label="Army 1"
        art={undefined}
        xp={260}
        stamina={{ current: 90, max: 150 }}
        troops={5_000}
        canBuyTier
        selected={false}
      />,
    );
    expect(text(markup)).toBe("2605,000");
    expect(markup).toContain('role="group"');
    // 90 of 150 is three segments full.
    expect(markup.match(/width:100%/g)).toHaveLength(3);
    expect(markup).toContain("width:0%");
  });

  it("says what the XP buys next on its badge's tooltip, and the balance alone once nothing is left to buy", () => {
    expect(xpLine(8, { price: 100, tier: 2 })).toBe("XP 8 of 100 · buys an Uncommon attribute tier");
    expect(xpLine(260, { price: 400, tier: 4 })).toBe("XP 260 of 400 · buys an Epic attribute tier");
    expect(xpLine(2_000, undefined)).toBe("XP 2,000");
    const markup = renderToStaticMarkup(
      <ArmyToken
        label="Army 1"
        art={undefined}
        xp={8}
        xpGoal={{ price: 100, tier: 2 }}
        stamina={undefined}
        troops={154}
        canBuyTier={false}
        selected={false}
      />,
    );
    expect(markup).toContain('data-tip="XP 8 of 100 · buys an Uncommon attribute tier"');
  });

  it("writes XP beside the number on the wide card, over a bar toward the next tier, with a pip for each tier reached", () => {
    act(() =>
      root.render(
        <ArmyToken
          label="Army 1"
          art={undefined}
          xp={25}
          xpGoal={{ price: 100, tier: 2 }}
          tiers={[2, 1, 3, 1]}
          stamina={{ current: 90, max: 150 }}
          troops={984}
          canBuyTier={false}
          selected={false}
          wide={{ secondsToFull: undefined, returnsHome: 0 }}
        />,
      ),
    );
    const xp = host.querySelector('[data-tip^="XP 25 of 100"]')!;
    expect(xp.textContent).toBe("25 XP");
    expect(xp.querySelector<HTMLElement>("b")!.style.width).toBe("25%");
    // Battle at uncommon is one pip, Scouting at rare two; the attributes still at common show none.
    expect(host.querySelector('[aria-label="Battle Uncommon"]')!.querySelectorAll("i")).toHaveLength(1);
    expect(host.querySelector('[aria-label="Scouting Rare"]')!.querySelectorAll("i")).toHaveLength(2);
    expect(host.querySelector('[aria-label^="Logistics"]')).toBeNull();
    expect(host.querySelector('[aria-label^="Homecoming"]')).toBeNull();
  });

  it("is picked with a tap, and an open slot opens Deploy", () => {
    const onPick = vi.fn();
    const onDeploy = vi.fn();
    act(() =>
      root.render(
        <>
          <ArmyToken
            label="Army 1"
            art={undefined}
            xp={undefined}
            stamina={undefined}
            troops={undefined}
            canBuyTier={false}
            selected
            onPick={onPick}
          />
          <OpenSlot label="Deploy" pulse onDeploy={onDeploy} />
        </>,
      ),
    );
    const [token, slot] = host.querySelectorAll("button");
    expect(token.textContent).toBe("——");
    expect(token.getAttribute("aria-pressed")).toBe("true");
    act(() => token.click());
    act(() => slot.click());
    expect(onPick).toHaveBeenCalled();
    expect(onDeploy).toHaveBeenCalled();
  });
});

describe("an open slot whose army is being deployed", () => {
  it("says Deploying…, pulses and cannot be pressed until the deploy's outcome", () => {
    const onDeploy = vi.fn();
    act(() => root.render(<OpenSlot label="Deploy" pulse={false} filling="Deploying…" wide onDeploy={onDeploy} />));
    const slot = host.querySelector("button")!;
    expect(slot.getAttribute("aria-label")).toBe("Deploying…");
    expect(slot.getAttribute("aria-busy")).toBe("true");
    expect(slot.textContent).toBe("…Deploying…");
    act(() => slot.click());
    expect(onDeploy).not.toHaveBeenCalled();
  });
});

describe("the place bar", () => {
  it("lights where the player is, dots Research when it can be bought, counts unread chat, and goes", () => {
    const onGo = vi.fn();
    act(() => root.render(<PlaceNav place="map" onGo={onGo} researchDot unread={3} />));
    const slots = [...host.querySelectorAll("button")];
    expect(slots.map((slot) => slot.textContent)).toEqual(["Map", "Realm", "Research", "3Chat", "Menu"]);
    expect(slots[0].getAttribute("aria-current")).toBe("page");
    expect(slots[2].querySelector("i")).not.toBeNull();
    act(() => slots[4].click());
    expect(onGo).toHaveBeenCalledWith("menu");
  });

  it("leaves Research out for a spectator, who has no realm to research", () => {
    act(() => root.render(<PlaceNav place="realm" onGo={vi.fn()} unread={0} />));
    const slots = [...host.querySelectorAll("button")].map((slot) => slot.textContent);
    expect(slots).toEqual(["Map", "Realm", "Chat", "Menu"]);
  });

  it("dots Research only when an open node's Essence is held", () => {
    const node = (state: "open" | "locked" | "learned", price: number) => ({
      node: 1,
      row: 10,
      state,
      price,
      effect: { kind: "depth" as const, depth: 1 as const },
    });
    expect(canResearchNow({ essence: 500, types: [], nodes: [node("open", 400)] })).toBe(true);
    expect(canResearchNow({ essence: 300, types: [], nodes: [node("open", 400), node("locked", 100)] })).toBe(false);
    expect(canResearchNow({ essence: undefined, types: [], nodes: [node("open", 0)] })).toBe(false);
    expect(canResearchNow(undefined)).toBe(false);
  });
});

describe("the Menu", () => {
  it("opens Today, Season with the rank, Production, the guide's lines and Settings, and closes on Resume", () => {
    const handlers = {
      onToday: vi.fn(),
      onSeason: vi.fn(),
      onProduction: vi.fn(),
      onGuide: vi.fn(),
      onSettings: vi.fn(),
      onExit: vi.fn(),
      onClose: vi.fn(),
    };
    const { onGuide, ...ways } = handlers;
    act(() => root.render(<MenuSheet rank="#12" guide={{ on: true, onOpen: onGuide }} {...ways} />));
    const button = (word: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("section[aria-label='Menu'] button")].find((candidate) =>
        candidate.textContent?.startsWith(word),
      )!;
    // The rank sits beside the row's own button, in the row.
    expect(button("Season").closest(".ui-row")?.textContent).toBe("Season#12");
    for (const [word, handler] of [
      ["Today", handlers.onToday],
      ["Season", handlers.onSeason],
      ["Production", handlers.onProduction],
      ["Guide", handlers.onGuide],
      ["Settings", handlers.onSettings],
      ["Exit", handlers.onExit],
      ["Resume", handlers.onClose],
    ] as const) {
      act(() => button(word).click());
      expect(handler).toHaveBeenCalled();
    }
  });

  it("offers a spectator no Production and no guide", () => {
    const ways = { onToday: vi.fn(), onSeason: vi.fn(), onSettings: vi.fn(), onExit: vi.fn(), onClose: vi.fn() };
    act(() => root.render(<MenuSheet rank="—" guide={null} onProduction={null} {...ways} />));
    const words = [...document.querySelectorAll("section[aria-label='Menu'] nav .ui-row")].map(
      (row) => row.textContent,
    );
    expect(words).toEqual(["Today", "Season—", "Settings"]);
  });
});

describe("the HUD's surfaces", () => {
  it("lets go of the tapped plot when a surface opens, so one sheet stands at a time", () => {
    const Host = () => {
      const [, setSurface] = useHudSurface();
      return (
        <button type="button" onClick={() => setSurface("research")}>
          Research
        </button>
      );
    };
    useUIStore.getState().setSelectedBuildingHex({ structureId: 7, innerCol: 10, innerRow: 10 });
    act(() => root.render(<Host />));
    act(() => host.querySelector("button")!.click());
    expect(useUIStore.getState().selectedBuildingHex).toBeNull();
  });
});

describe("the order bar", () => {
  const covered = { cost: 30, held: 90, wait: undefined };

  it("reads the labor half of a reveal apart, in ember, when labor no longer fits", () => {
    act(() =>
      root.render(
        <OrderBar
          kind="explore"
          tiles={1}
          stamina={covered}
          wheat={{ cost: 100, held: 4_410, wait: undefined }}
          revealYield={500}
          laborFits={0}
          xp={2}
          onCancel={() => {}}
          onGo={() => {}}
        />,
      ),
    );
    expect(host.querySelector('[aria-label="Essence +500"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="labor +0"]')?.getAttribute("data-tone")).toBe("bad");
  });

  it("shows what an order leaves and earns, then Cancel and the verb", () => {
    const onGo = vi.fn();
    act(() =>
      root.render(
        <OrderBar
          kind="explore"
          tiles={1}
          stamina={covered}
          wheat={{ cost: 100, held: 4_410, wait: undefined }}
          revealYield={500}
          xp={2}
          onCancel={() => {}}
          onGo={onGo}
        />,
      ),
    );
    expect([...host.querySelectorAll('[role="img"]')].map((chip) => chip.getAttribute("aria-label"))).toEqual([
      "stamina 90 → 60",
      "wheat −100",
      "Essence, labor +500",
    ]);
    expect(host.textContent).toContain("+2 XP");
    const buttons = [...host.querySelectorAll("button")].map((button) => button.textContent);
    expect(buttons).toEqual(["Cancel", "Explore"]);
    act(() => host.querySelectorAll("button")[1].click());
    expect(onGo).toHaveBeenCalled();
  });

  it("names a fractional wheat charge as charged, covered or short", () => {
    const bar = (wheat: { cost: number; held: number }) =>
      root.render(
        <OrderBar
          kind="move"
          tiles={1}
          stamina={covered}
          wheat={{ ...wheat, wait: undefined }}
          revealYield={null}
          xp={undefined}
          onCancel={() => {}}
          onGo={() => {}}
        />,
      );
    const wheatChip = () =>
      [...host.querySelectorAll('[role="img"]')]
        .map((chip) => chip.getAttribute("aria-label"))
        .find((label) => label?.startsWith("wheat"));

    // 30 troops' step at 0.02 wheat each.
    act(() => bar({ cost: 0.6, held: 10 }));
    expect(wheatChip()).toBe("wheat −0.6");
    // Short: what is held counts down to whole units, so 0.5 held never reads as the 0.6 it needs.
    act(() => bar({ cost: 0.6, held: 0.5 }));
    expect(wheatChip()).toBe("wheat 0 / 0.6");
  });

  it("confirms on Enter and takes the key, but never while the player types", () => {
    const onGo = vi.fn();
    act(() =>
      root.render(
        <>
          <input aria-label="message" />
          <OrderBar
            kind="move"
            tiles={2}
            stamina={covered}
            wheat={{ cost: 4, held: 4_410, wait: undefined }}
            revealYield={null}
            xp={undefined}
            onCancel={() => {}}
            onGo={onGo}
          />
        </>,
      ),
    );
    const typed = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    host.querySelector("input")!.dispatchEvent(typed);
    expect(onGo).not.toHaveBeenCalled();
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    document.body.dispatchEvent(enter);
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(enter.defaultPrevented).toBe(true);
  });

  it("turns a short cost ember with its exact wait, and takes the verb away", () => {
    act(() =>
      root.render(
        <OrderBar
          kind="move"
          tiles={3}
          stamina={covered}
          wheat={{ cost: 300, held: 40, wait: 4 * 60 }}
          revealYield={null}
          xp={undefined}
          onCancel={() => {}}
          onGo={() => {}}
        />,
      ),
    );
    const wheat = host.querySelector('[aria-label="wheat 40 / 300"]');
    expect(wheat?.getAttribute("data-tone")).toBe("bad");
    expect(host.querySelector('[aria-label="left 4m"]')).not.toBeNull();
    expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Cancel"]);
  });

  it("waits for wheat at the farms' rate, and never for wheat already held or never coming", () => {
    expect(secondsUntilHeld(40, 100, 900)).toBe(240);
    expect(secondsUntilHeld(100, 100, 900)).toBeUndefined();
    expect(secondsUntilHeld(40, 100, 0)).toBeUndefined();
    expect(secondsUntilHeld(undefined, 100, 900)).toBeUndefined();
  });
});

describe("the chat key", () => {
  const Chat = ({ onOpen }: { onOpen: () => void }) => {
    const pane = useChatKey(onOpen);
    return (
      <section ref={pane}>
        <input aria-label="message" />
      </section>
    );
  };
  const enter = () => new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });

  it("opens chat on Enter and puts the cursor in its field", () => {
    const onOpen = vi.fn();
    act(() => root.render(<Chat onOpen={onOpen} />));
    act(() => void document.body.dispatchEvent(enter()));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(host.querySelector("input"));
  });

  it("leaves an Enter that a preview's verb took, and one typed in a field", () => {
    const onOpen = vi.fn();
    act(() => root.render(<Chat onOpen={onOpen} />));
    const taken = enter();
    taken.preventDefault();
    act(() => void document.body.dispatchEvent(taken));
    act(() => void host.querySelector("input")!.dispatchEvent(enter()));
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("the HUD's panels", () => {
  it("lets a sheet opened from a nav page step back to it, and closes one opened anywhere else", () => {
    const sheet = (label: string) => (
      <Sheet label={label} onClose={() => undefined}>
        <p>rows</p>
      </Sheet>
    );
    act(() =>
      root.render(
        <HudBands strip={null} page={sheet("Farm")}>
          {sheet("Camp")}
        </HudBands>,
      ),
    );
    const mark = (label: string) =>
      host.querySelector(`[aria-label="${label}"][data-kit-sheet]`)!.querySelectorAll("button[aria-label]");
    expect([...mark("Farm")].map((button) => button.getAttribute("aria-label"))).toEqual(["Close", "Back"]);
    expect([...mark("Camp")].map((button) => button.getAttribute("aria-label"))).toEqual(["Close", "Close"]);
  });
});
