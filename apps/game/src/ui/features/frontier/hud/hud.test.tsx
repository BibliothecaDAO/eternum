import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";

import { canResearchNow } from "../research/research-plan";
import { secondsUntilHeld } from "./army-order";
import { ArmyToken, OpenSlot } from "./army-token";
import { dayClock } from "./day-clock";
import { type HudSurface, useHudSurface } from "./frontier-nav";
import { MenuSheet } from "./menu-sheet";
import { OrderBar } from "./order-bar";
import { PlaceNav } from "./place-nav";
import { StatusStrip, type StoreReading } from "./status-strip";

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
  const rules = { epochSeconds: 16 * 3_600, startMainAt: 0 };

  it("counts days from one, ends today at the epoch's edge and says tomorrow lasts a day", () => {
    const now = 11 * 16 * 3_600 + 9 * 3_600;
    const clock = dayClock(rules, now);
    expect(clock.day).toBe(12);
    expect(clock.endsAt).toBe(12 * 16 * 3_600);
    expect(clock.secondsLeft).toBe(7 * 3_600);
    expect(clock.tomorrowSeconds).toBe(16 * 3_600);
    expect(clock.shareLeft).toBeCloseTo(7 / 16);
    expect(clock.tone).toBe("calm");
  });

  it("turns ember in the last hour, and knows nothing before the season starts", () => {
    expect(dayClock(rules, 16 * 3_600 - 600).tone).toBe("ember");
    const before = dayClock({ ...rules, startMainAt: 10 * 16 * 3_600 }, 3_600);
    expect(before.day).toBeUndefined();
    expect(before.endsAt).toBeUndefined();
  });
});

describe("the status strip", () => {
  const store = (kind: StoreReading["kind"], amount: number | undefined, limit?: number): StoreReading => ({
    kind,
    amount,
    limit,
    tone: "calm",
    flyTarget: `test-${kind}`,
  });

  it("shows each store with a limit bar where it has a limit, and dashes the unknown", () => {
    const clock = dayClock({ epochSeconds: 16 * 3_600, startMainAt: 0 }, 9 * 3_600);
    const markup = renderToStaticMarkup(
      <StatusStrip
        clock={clock}
        stores={[store("essence", 18_250), store("labor", 9_000, 18_000), store("wheat", undefined, 18_000)]}
      />,
    );
    expect(markup.match(/role="meter"/g)).toHaveLength(2);
    expect(markup).toContain("width:50%");
    expect(text(markup)).toContain("—");
    expect(text(markup)).toContain("Tomorrow lasts16h");
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

  it("dots Research only when an open node's Essence is held", () => {
    const node = (state: "open" | "locked" | "learned", price: number) => ({
      node: 1,
      state,
      price,
      effect: { kind: "depth" as const, depth: 1 as const },
    });
    expect(canResearchNow({ essence: 500, nodes: [node("open", 400)] })).toBe(true);
    expect(canResearchNow({ essence: 300, nodes: [node("open", 400), node("locked", 100)] })).toBe(false);
    expect(canResearchNow({ essence: undefined, nodes: [node("open", 0)] })).toBe(false);
    expect(canResearchNow(undefined)).toBe(false);
  });
});

describe("the Menu", () => {
  it("opens Today, Season with the rank, Production, the guide and Settings, and closes on Resume", () => {
    const handlers = {
      onToday: vi.fn(),
      onSeason: vi.fn(),
      onProduction: vi.fn(),
      onGuide: vi.fn(),
      onSettings: vi.fn(),
      onExit: vi.fn(),
      onClose: vi.fn(),
    };
    act(() => root.render(<MenuSheet rank="#12" {...handlers} />));
    const button = (word: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("section[aria-label='Menu'] button")].find((candidate) =>
        candidate.textContent?.startsWith(word),
      )!;
    expect(button("Season").textContent).toBe("Season#12");
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
});

describe("the HUD's surfaces", () => {
  it("lets go of the tapped plot when a surface opens, so one sheet stands at a time", () => {
    let open: (surface: HudSurface | null) => void = () => {};
    const Host = () => {
      const [, setSurface] = useHudSurface();
      open = setSurface;
      return null;
    };
    useUIStore.getState().setSelectedBuildingHex({ structureId: 7, innerCol: 10, innerRow: 10 });
    act(() => root.render(<Host />));
    act(() => open("research"));
    expect(useUIStore.getState().selectedBuildingHex).toBeNull();
  });
});

describe("the order bar", () => {
  const covered = { cost: 30, held: 90, wait: undefined };

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
      "XP +2",
    ]);
    const buttons = [...host.querySelectorAll("button")].map((button) => button.textContent);
    expect(buttons).toEqual(["Cancel", "Explore"]);
    act(() => host.querySelectorAll("button")[1].click());
    expect(onGo).toHaveBeenCalled();
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
    expect(wheat?.getAttribute("data-tone")).toBe("loss");
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
