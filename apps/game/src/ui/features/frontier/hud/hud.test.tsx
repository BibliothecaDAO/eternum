import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { dayOf } from "@bibliothecadao/eternum";
import { FRONTIER_TROOP_NAMES, TroopType } from "@bibliothecadao/types";

import { OpeningProvider } from "../opening/opening-context";
import { EARLY_REALM, MID_REALM } from "../research/progression-fixture";
import { canResearchNow, readResearchTree } from "../research/research-tree";
import { secondsUntilHeld } from "./army-order";
import { ArmyCard, OpenSlotCard } from "./army-row";
import { ArmyToken, OpenSlot } from "./army-token";
import { useChatKey } from "./chat-key";
import { dayClock, dayBounds, endedDay, seasonDay } from "./day-clock";
import { armyName } from "./dock-armies";
import { HudBands } from "./hud-bands";
import { useOnePanel } from "./one-panel";
import { MenuPage } from "./menu-page";
import { OrderBar } from "./order-bar";
import { PickedArmy } from "./picked-army";
import { DayPill } from "./day-pill";
import { RealmCard } from "./realm-card";
import { TopBarView } from "./phone-top-bar";
import { PhoneTabBar } from "./frontier-nav";
import { HUD_PLACES } from "./hud-places";
import { OfflineBanner, OfflineNotice } from "./offline-notice";
import { type StoreReading, storeLine, storeRateText } from "./status-strip";
import { tomorrowLasts } from "@/ui/design-system/kit/words";

const text = (markup: string) => new DOMParser().parseFromString(markup, "text/html").body.textContent ?? "";

let host: HTMLDivElement;
let root: Root;
/** The buttons drawn, by the name a player or a screen reader meets them by. */
const barButtons = () =>
  [...host.querySelectorAll("button")].map((button) => button.getAttribute("aria-label") ?? button.textContent);

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
  const rules = {
    dayUnitSeconds: 4 * 3_600,
    seed: 1n,
    startMainAt: 0,
    scheduledEndAt: 21 * 20 * 14_400,
    endAt: 21 * 20 * 14_400,
  };

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
  it("says a store in one line: what it holds of its limit, its rate and when it is full", () => {
    const wheat: StoreReading = { kind: "wheat", amount: 1_771, limit: 6_000, tone: "calm", flyTarget: "wheat" };
    expect(storeLine({ ...wheat, perHour: 302, fullIn: 14 * 3_600 })).toBe(
      "Wheat 1,771 of 6,000 · +5/min · Full in 14h",
    );
    expect(storeLine({ ...wheat, amount: 6_000, perHour: 302, fullIn: 0 })).toBe("Wheat 6,000 of 6,000 · Full");
    // No building makes it: no rate to say, and no moment it fills.
    expect(storeLine(wheat)).toBe("Wheat 1,771 of 6,000");
    // Essence has no limit.
    expect(storeLine({ ...wheat, kind: "essence", amount: 18_250, limit: undefined })).toBe("Essence 18,250");
    expect(storeLine({ ...wheat, amount: undefined })).toBe("Wheat — of 6,000");
  });

  const store = (kind: StoreReading["kind"], amount: number | undefined, limit?: number): StoreReading => ({
    kind,
    amount,
    limit,
    tone: "calm",
    flyTarget: `test-${kind}`,
  });

  it("reads a 24-hour day in hours on the day pill, as Play does: never '1d' (live-qa-night-1 P3-8)", () => {
    const day = dayClock(
      {
        dayUnitSeconds: 4 * 3_600,
        seed: 1n,
        startMainAt: 0,
        scheduledEndAt: 21 * 20 * 14_400,
        endAt: 21 * 20 * 14_400,
      },
      3_600,
    );
    const clock = { ...day, secondsLeft: 24 * 3_600, tomorrowSeconds: 24 * 3_600 };
    const markup = renderToStaticMarkup(<DayPill clock={clock} />);
    expect(markup).toContain(`aria-label="Day ${day.day}`);
    expect(text(markup)).toContain("24h");
    expect(markup).not.toMatch(/\b1d\b/);
  });

  it("turns the day pill red in its last hour", () => {
    const day = dayClock(
      {
        dayUnitSeconds: 4 * 3_600,
        seed: 1n,
        startMainAt: 0,
        scheduledEndAt: 21 * 20 * 14_400,
        endAt: 21 * 20 * 14_400,
      },
      3_600,
    );
    const morning = renderToStaticMarkup(<DayPill clock={{ ...day, shareLeft: 0.75, tone: "calm" }} />);
    expect(text(morning)).not.toContain("Day ends");
    expect(text(morning)).not.toContain(tomorrowLasts(0).words);
    expect(morning).toContain("text-hud-ink");
    expect(morning).not.toContain("text-hud-bad");
    expect(morning).toContain('data-fill-share="25"');
    const lastHour = renderToStaticMarkup(
      <DayPill clock={{ ...day, secondsLeft: 600, shareLeft: 0.05, tone: "ember" }} />,
    );
    expect(lastHour).toContain(`aria-label="Day ${day.day}`);
    expect(text(lastHour)).toContain("10m");
    expect(lastHour).toContain("text-hud-bad");
    expect(lastHour).toContain('data-fill-share="95"');
    expect(lastHour).toContain('data-tone="ember"');
  });

  it("draws the phone and tablet day pill inline with the sun progress ring, Day numeral, time left, and ember tone in the last hour", () => {
    const day = dayClock(
      {
        dayUnitSeconds: 4 * 3_600,
        seed: 1n,
        startMainAt: 0,
        scheduledEndAt: 21 * 20 * 14_400,
        endAt: 21 * 20 * 14_400,
      },
      3_600,
    );
    act(() => root.render(<DayPill clock={{ ...day, secondsLeft: 900, shareLeft: -0.2, tone: "ember" }} compact />));
    const timer = host.querySelector('[role="timer"]')!;
    expect(timer.getAttribute("data-tone")).toBe("ember");
    expect(timer.getAttribute("data-compact")).toBe("true");
    expect(timer.querySelector(".frontier-day-pill__day")?.textContent).toBe(`Day ${day.day}`);
    expect(timer.querySelector(".frontier-day-pill__left")?.textContent).toBe("15m");
    expect(timer.querySelector(".frontier-progress-ring")).not.toBeNull();
    expect(timer.querySelector<HTMLElement>(".frontier-day-pill__share")?.style.width).toBe("100%");
    expect(timer.getAttribute("aria-label")).toContain(`Day ${day.day} · 15m left`);
    expect(timer.getAttribute("data-tip")).toContain("15m left");
  });

  it("lays a phone's and a tablet's one bar: the place switch, Essence, Labor and Wheat opening the realm, the day; the lesson and the quest under it", () => {
    const day = dayClock(
      {
        dayUnitSeconds: 4 * 3_600,
        seed: 1n,
        startMainAt: 0,
        scheduledEndAt: 21 * 20 * 14_400,
        endAt: 21 * 20 * 14_400,
      },
      3_600,
    );
    const onOpenRealm = vi.fn();
    act(() =>
      root.render(
        <TopBarView
          clock={<DayPill clock={day} compact />}
          stocks={{
            realmName: "Duskbite",
            onOpenRealm,
            stores: [
              store("essence", 125_000),
              { ...store("labor", 9_000, 18_000), perHour: 180 },
              store("wheat", 3_000, 6_000),
              store("troops", 1_500, 3_000),
            ],
          }}
          placeSwitch={<button type="button">Places</button>}
          notice={<aside aria-label="Lesson" />}
          quest={<button type="button">Quest</button>}
        />,
      ),
    );
    const bar = host.querySelector(".frontier-bar")!;
    expect([...bar.children].map((part) => part.textContent)).toEqual(["Places", "125K9K3K", "Day 111h"]);
    const realm = bar.querySelector<HTMLButtonElement>('button[aria-label="Duskbite"]')!;
    expect([...realm.querySelectorAll(".frontier-stock-chip")].map((chip) => chip.getAttribute("data-store"))).toEqual([
      "essence",
      "labor",
      "wheat",
    ]);
    act(() => realm.click());
    expect(onOpenRealm).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.frontier-phone-float__lead > aside[aria-label="Lesson"]')).not.toBeNull();
    expect(host.querySelector(".frontier-phone-float__quest")?.textContent).toBe("Quest");
  });

  it("opens a phone's quest on its bubble's own row and leaves the lesson showing on the row under it", () => {
    act(() =>
      root.render(
        <TopBarView
          clock={<span>Day</span>}
          stocks={{ stores: [store("essence", 125_000)] }}
          notice={<aside aria-label="Lesson" />}
          quest={<button type="button" data-daily-quest-chip="" />}
          questCard={<section data-daily-quest="" />}
        />,
      ),
    );
    const float = host.querySelector(".frontier-phone-float")!;
    expect([...float.querySelector(".frontier-phone-float__quest")!.children].map((part) => part.outerHTML)).toEqual([
      '<section data-daily-quest=""></section>',
      '<button type="button" data-daily-quest-chip=""></button>',
    ]);
    expect(float.querySelector('.frontier-phone-float__lead > aside[aria-label="Lesson"]')).not.toBeNull();
  });

  it("puts the open realm card right under the bar, in the lesson's and the quest's place", () => {
    act(() =>
      root.render(
        <TopBarView
          clock={<span>Day</span>}
          stocks={{ stores: [store("essence", 125_000)] }}
          notice={<aside aria-label="Lesson" />}
          quest={<button type="button">Quest</button>}
          realmCard={<section aria-label="Duskbite" />}
        />,
      ),
    );
    const top = host.querySelector(".frontier-phone-top")!;
    expect([...top.children].map((part) => part.className || part.getAttribute("aria-label"))).toEqual([
      "ui-popover frontier-bar pointer-events-auto",
      "Duskbite",
    ]);
  });

  it("shows the realm card's stores in order with rates, exact accessible labels and the Fragments tile", () => {
    const onShop = vi.fn();
    act(() =>
      root.render(
        <RealmCard
          name="Duskbite"
          kind="realm"
          level={1}
          fragments={250}
          lords={null}
          onShop={onShop}
          stores={[
            store("essence", 125_000),
            store("labor", 18_000, 18_000),
            { ...store("wheat", undefined, 6_000), perHour: 300 },
            store("troops", 420, 1_500),
          ]}
        />,
      ),
    );
    const plates = [...host.querySelectorAll('[data-store] [role="img"]')];
    expect(plates.map((plate) => plate.closest("[data-store]")!.getAttribute("data-store"))).toEqual([
      "essence",
      "labor",
      "wheat",
      "lords",
      "troops",
    ]);
    expect(plates.map((plate) => plate.getAttribute("aria-label"))).toEqual([
      "Essence 125,000",
      "Labor 18,000 of 18,000",
      "Wheat — of 6,000 · +5/min",
      "LORDS",
      "Knights 420 of 1,500",
    ]);
    expect(host.querySelector('[data-store="wheat"] .frontier-realm-card__caption')?.textContent).toBe("+5/min");
    expect(host.querySelector('[data-store="labor"] .frontier-realm-card__caption')?.textContent).toBe("Labor");
    const fragments = host.querySelector<HTMLButtonElement>('[data-store="fragments"] button');
    expect(fragments?.getAttribute("aria-label")).toBe("Fragments 250");
    act(() => fragments!.click());
    expect(onShop).toHaveBeenCalledTimes(1);
  });

  it("formats store rates through one helper", () => {
    expect(storeRateText({ ...store("labor", 100, 1_000), perHour: 180 })).toBe("+3/min");
    expect(storeRateText({ ...store("troops", 100, 1_000), perHour: 100 })).toBe("+1.7/min");
    expect(storeRateText({ ...store("labor", 1_000, 1_000), perHour: 180, fullIn: 0 })).toBeNull();
    expect(storeRateText({ ...store("labor", 100, 1_000), perHour: 0 })).toBeNull();
  });
});

describe("the army token", () => {
  // Frontier's explore costs 20 stamina (config/source/frontier/base.ts).
  const token = (stamina: { current: number; max: number }) =>
    renderToStaticMarkup(
      <ArmyToken
        label="Army 1"
        art={undefined}
        stamina={{ ...stamina, perExplore: 20 }}
        troops={5_000}
        selected={false}
      />,
    );
  /** The bar's segments as drawn: each one's length (its flex-grow) and fill. */
  const staminaFills = (markup: string) =>
    [...markup.matchAll(/role="meter"[^>]*><i[^>]*width:([\d.]+)%/g)].map(([, fill]) => Number(fill));

  it("wears no XP number, its stamina one unbroken bar, and its troops", () => {
    const markup = token({ current: 60, max: 120 });
    // The owner, 13 November 2026: no XP number on the army; its way to the next point is a ring.
    expect(text(markup)).toBe("5,000");
    expect(markup).toContain('role="group"');
    expect(staminaFills(markup)).toEqual([50]);
    expect(staminaFills(token({ current: 90, max: 150 }))).toEqual([60]);
  });

  it("reads an army on a desktop's card: its title and its stamina exact", () => {
    const onPick = vi.fn();
    act(() =>
      root.render(
        <ArmyCard
          label="Army 2"
          number={2}
          art={undefined}
          stamina={{ current: 90, max: 150, perExplore: 20 }}
          selected
          onPick={onPick}
        />,
      ),
    );
    expect(host.textContent).toContain("Army 2");
    expect(host.textContent).toContain("90/150");
    const meter = host.querySelector('[role="meter"]')!;
    expect([meter.getAttribute("aria-valuenow"), meter.getAttribute("aria-valuemax")]).toEqual(["90", "150"]);
    const card = host.querySelector<HTMLButtonElement>('button[aria-label="Army 2"]')!;
    expect(card.getAttribute("aria-pressed")).toBe("true");
    act(() => card.click());
    expect(onPick).toHaveBeenCalled();
  });

  it("is picked with a tap, and an open slot opens Deploy", () => {
    const onPick = vi.fn();
    const onDeploy = vi.fn();
    act(() =>
      root.render(
        <>
          <ArmyToken label="Army 1" art={undefined} stamina={undefined} troops={undefined} selected onPick={onPick} />
          <OpenSlot label="Deploy" pulse onDeploy={onDeploy} />
        </>,
      ),
    );
    const [token, slot] = host.querySelectorAll("button");
    expect(token.textContent).toBe("—");
    expect(token.getAttribute("aria-pressed")).toBe("true");
    act(() => token.click());
    act(() => slot.click());
    expect(onPick).toHaveBeenCalled();
    expect(onDeploy).toHaveBeenCalled();
  });
});

describe("an open slot whose army is being deployed", () => {
  it("says Deploying… on its Deploy and cannot be pressed until the deploy's outcome", () => {
    const onDeploy = vi.fn();
    act(() => root.render(<OpenSlotCard number={2} primary filling="Deploying…" onDeploy={onDeploy} />));
    const deploy = host.querySelector("button")!;
    expect(host.textContent).toContain("Slot 2 · Open");
    expect(deploy.getAttribute("aria-label")).toBe("Deploy");
    expect(deploy.getAttribute("aria-busy")).toBe("true");
    expect(deploy.textContent).toBe("Deploying…");
    act(() => deploy.click());
    expect(onDeploy).not.toHaveBeenCalled();
  });
});

describe("the phone tab bar", () => {
  it("lays Research, Season, Chat and Menu, each with its count, and lights the open page", () => {
    const onSurface = vi.fn();
    act(() =>
      root.render(<PhoneTabBar surface={null} onSurface={onSurface} researchReady feedUnread={2} chatUnread={3} />),
    );
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Research", "Season", "Chat", "Menu"]);
    expect(buttons.map((button) => button.getAttribute("aria-current"))).toEqual([null, null, null, null]);
    expect(buttons.map((button) => button.querySelector(".frontier-tab__badge")?.textContent ?? null)).toEqual([
      "1",
      null,
      "3",
      null,
    ]);
    expect(buttons[3]!.querySelector("[data-dot]")).not.toBeNull();
    act(() => buttons[1]!.click());
    expect(onSurface).toHaveBeenLastCalledWith("season");
    act(() =>
      root.render(
        <PhoneTabBar surface="today" onSurface={onSurface} researchReady={false} feedUnread={0} chatUnread={0} />,
      ),
    );
    expect(barButtons()).toEqual(["Research", "Season", "Chat", "Menu"]);
    expect(host.querySelector('button[aria-label="Menu"]')!.getAttribute("aria-current")).toBe("page");
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Menu"]')!.click());
    expect(onSurface).toHaveBeenLastCalledWith("menu");
  });

  it("keeps Season on the tab bar from the first minute while Research waits on its moment", () => {
    act(() =>
      root.render(
        <OpeningProvider opened={new Set()}>
          <PhoneTabBar surface={null} onSurface={vi.fn()} researchReady={false} feedUnread={0} chatUnread={0} />
        </OpeningProvider>,
      ),
    );
    expect(barButtons()).toEqual(["Season", "Chat", "Menu"]);
  });

  it("names an army by its troops, and the picked army by that name alone, with no chip for the count", () => {
    expect(armyName(TroopType.Paladin, 6_938)).toBe(`6,938 ${FRONTIER_TROOP_NAMES[TroopType.Paladin].many}`);
    expect(armyName(TroopType.Crossbowman, 1)).toBe(`1 ${FRONTIER_TROOP_NAMES[TroopType.Crossbowman].one}`);
    act(() =>
      root.render(
        <PickedArmy
          army={{
            explorerId: 7,
            label: armyName(TroopType.Paladin, 400),
            number: 1,
            art: "paladin-t1",
            stamina: { current: 100, max: 100, perExplore: 10 },
            secondsToFull: 0,
            ethereal: undefined,
          }}
          refill={null}
          onDetails={() => undefined}
        />,
      ),
    );
    expect(host.querySelector(".army-tray__name")?.textContent).toBe("400 Scouts");
    expect(host.querySelector(".ui-chip")).toBeNull();
  });

  it("orders HUD_PLACES as the cornice does", () => {
    expect(HUD_PLACES.map((place) => place.key)).toEqual(["research", "season", "feed", "chat"]);
  });

  it("dots Research only while a node can be researched now", () => {
    expect(canResearchNow(readResearchTree(EARLY_REALM))).toBe(false);
    expect(canResearchNow(readResearchTree(MID_REALM))).toBe(true);
    expect(canResearchNow(undefined)).toBe(false);
  });
});

describe("the Menu", () => {
  it("holds what the tab bar does not: the Feed with its unread count, Today, Shop, Settings and the Guide, then Exit", () => {
    const handlers = {
      onFeed: vi.fn(),
      onShop: vi.fn(),
      onToday: vi.fn(),
      onSettings: vi.fn(),
      onExit: vi.fn(),
      onClose: vi.fn(),
    };
    act(() => root.render(<MenuPage events={2} guide="https://docs.realms.party/frontier/" {...handlers} />));
    const words = [...document.querySelectorAll("section[aria-label='Menu'] nav .menu-tile")].map(
      (tile) => tile.textContent,
    );
    expect(words).toEqual(["Feed2", "Today", "Shop", "Settings", "Guide", "Exit"]);
    const button = (word: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("section[aria-label='Menu'] button")].find((candidate) =>
        candidate.textContent?.startsWith(word),
      )!;
    for (const [word, handler] of [
      ["Feed", handlers.onFeed],
      ["Shop", handlers.onShop],
      ["Today", handlers.onToday],
      ["Settings", handlers.onSettings],
      ["Exit", handlers.onExit],
    ] as const) {
      act(() => button(word).click());
      expect(handler).toHaveBeenCalled();
    }
    expect(button("Resume")).toBeUndefined();
    act(() =>
      document.querySelector<HTMLButtonElement>("section[aria-label='Menu'] button[aria-label='Close']")!.click(),
    );
    expect(handlers.onClose).toHaveBeenCalled();
  });
});

describe("the HUD's surfaces", () => {
  it("lets go of the tapped plot when a surface opens, so one sheet stands at a time", () => {
    const Host = () => {
      const { openSurface } = useOnePanel(null);
      return (
        <button type="button" onClick={() => openSurface("research")}>
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

  // Owner, 27 October 2026: "Yes double tapping to explore on mobile, the confirm bar can be compacted into one single
  // row". The second tap on the tile sends the order (worldmap-order-preview.test.tsx); the bar is its preview.
  it("shows in one row what an order leaves, its verb to send it and × to drop it", () => {
    const onCancel = vi.fn();
    const onGo = vi.fn();
    act(() =>
      root.render(
        <OrderBar
          kind="explore"
          stamina={covered}
          wheat={{ cost: 100, held: 4_410, wait: undefined }}
          onCancel={onCancel}
          onGo={onGo}
        />,
      ),
    );
    expect(host.children).toHaveLength(1);
    // Named for assistive technology (and the playtest's phone step) by its order; its icons say it on screen.
    expect(host.querySelector('section[aria-label="Explore"]')).not.toBeNull();
    expect([...host.querySelectorAll('[role="img"]')].map((chip) => chip.getAttribute("aria-label"))).toEqual([
      "stamina 90 → 60",
      "Wheat −100",
    ]);
    expect(host.textContent).toBe("90 → 60−100Explore");
    expect(barButtons()).toEqual(["Explore", "Cancel"]);
    act(() => host.querySelector<HTMLButtonElement>('button[data-kind="primary"]')!.click());
    expect(onGo).toHaveBeenCalledTimes(1);
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Cancel"]')!.click());
    expect(onCancel).toHaveBeenCalled();
  });

  it("stands the refill in the row when the order's stamina is short", () => {
    act(() =>
      root.render(
        <OrderBar
          kind="explore"
          stamina={{ cost: 30, held: 13, wait: 111 }}
          wheat={{ cost: 100, held: 4_410, wait: undefined }}
          refill={<button type="button">Refill</button>}
          onCancel={() => {}}
          onGo={() => {}}
        />,
      ),
    );
    expect(host.children).toHaveLength(1);
    expect(host.querySelector('section[aria-label="Explore"] [data-tone="bad"]')).not.toBeNull();
    expect(barButtons()).toEqual(["Refill", "Cancel"]);
  });

  it("names a fractional wheat charge as charged, covered or short", () => {
    const bar = (wheat: { cost: number; held: number }) =>
      root.render(
        <OrderBar
          kind="move"
          stamina={covered}
          wheat={{ ...wheat, wait: undefined }}
          onCancel={() => {}}
          onGo={() => {}}
        />,
      );
    const wheatChip = () =>
      [...host.querySelectorAll('[role="img"]')]
        .map((chip) => chip.getAttribute("aria-label"))
        .find((label) => label?.startsWith("Wheat"));

    // 30 troops' step at 0.02 wheat each.
    act(() => bar({ cost: 0.6, held: 10 }));
    expect(wheatChip()).toBe("Wheat −<1");
    // Short under a unit: what is held reads as held, below what is needed.
    act(() => bar({ cost: 0.6, held: 0.5 }));
    expect(wheatChip()).toBe("Wheat 0.5 / 0.6");
  });

  describe("a cost on either side of its rounding", () => {
    const explore = (wheat: { cost: number; held: number }, onGo = vi.fn()) => {
      act(() =>
        root.render(
          <OrderBar
            kind="explore"
            stamina={{ cost: 21, held: 120, wait: undefined }}
            wheat={{ ...wheat, wait: undefined }}
            onCancel={() => {}}
            onGo={onGo}
          />,
        ),
      );
      return onGo;
    };
    const wheatChip = () => host.querySelector('[aria-label^="wheat "]')!.getAttribute("aria-label");
    const buttons = barButtons;

    // QA's 28.15 wheat (563 troops at 0.05 a step) rounds to 28; held just under it must not read as 28 of 28.
    it.each([
      [28, "Wheat 28 / 28.2"],
      [28.1, "Wheat 28.1 / 28.2"],
      [28.149, "Wheat 28.1 / 28.2"],
    ])("never reads a short %s of 28.15 as met, and offers only Cancel", (held, chip) => {
      const onGo = explore({ cost: 28.15, held });
      expect(wheatChip()).toBe(chip);
      expect(buttons()).toEqual(["Cancel"]);
      act(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
      expect(onGo).not.toHaveBeenCalled();
    });

    it.each([28.15, 28.2, 28.99])("takes a covered %s of 28.15 at its rounded charge, once", (held) => {
      const onGo = explore({ cost: 28.15, held });
      expect(wheatChip()).toBe("Wheat −28");
      act(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
      expect(onGo).toHaveBeenCalledOnce();
    });

    it("tells a short compact cost from what is held", () => {
      explore({ cost: 12_449, held: 12_440 });
      expect(wheatChip()).toBe("Wheat 12,440 / 12,449");
    });
  });

  it("confirms on Enter and takes the key, but never while the player types", () => {
    const onGo = vi.fn();
    act(() =>
      root.render(
        <>
          <input aria-label="message" />
          <OrderBar
            kind="move"
            stamina={covered}
            wheat={{ cost: 4, held: 4_410, wait: undefined }}
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
          stamina={covered}
          wheat={{ cost: 300, held: 40, wait: 4 * 60 }}
          onCancel={() => {}}
          onGo={() => {}}
        />,
      ),
    );
    const wheat = host.querySelector('[aria-label="Wheat 40 / 300"]');
    expect(wheat?.getAttribute("data-tone")).toBe("bad");
    expect(host.querySelector('[aria-label="left 4m"]')).not.toBeNull();
    expect(barButtons()).toEqual(["Cancel"]);
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
  it("closes every sheet on its cross, one opened from a nav page as one opened anywhere else", () => {
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
    expect([...mark("Farm")].map((button) => button.getAttribute("aria-label"))).toEqual(["Close", "Close"]);
    expect([...mark("Camp")].map((button) => button.getAttribute("aria-label"))).toEqual(["Close", "Close"]);
  });
});

it.each([81, 84, 85])("shows the last %ih day with its real countdown and no tomorrow", (hours) => {
  const endAt = hours * 3600;
  const calendar = { seed: 0x5eedn, startMainAt: 0, scheduledEndAt: endAt, endAt, dayUnitSeconds: 7200 };
  const clock = dayClock(calendar, endAt - 600);
  const day = hours === 81 ? 10 : 11;
  expect(clock).toMatchObject({ day, endsAt: endAt, secondsLeft: 600, tomorrowSeconds: undefined, tone: "ember" });
  const markup = renderToStaticMarkup(<DayPill clock={clock} />);
  expect(markup).toContain(`aria-label="Day ${day}`);
  expect(text(markup)).toContain("10m");
  expect(markup).not.toContain("Tomorrow");
  expect(seasonDay(calendar, endAt - 1)).toEqual({ day, lastDay: day });
  const start = (hours === 81 ? 68 : 80) * 3600;
  expect(dayBounds(calendar, endAt + 1, day)).toEqual({ start, end: endAt });
  expect(endedDay(calendar, endAt)).toBeNull();
  expect(dayClock(calendar, endAt).day).toBeUndefined();
});

describe("the offline banner", () => {
  afterEach(() => {
    useConnectionStore.getState().setGlobalStatus("connected");
  });

  it("offers no retry while the client retries by itself, and one that retries once it gave up", () => {
    const onRetry = vi.fn();
    act(() => root.render(<OfflineBanner onRetry={onRetry} />));
    const reconnecting = host.querySelector<HTMLElement>('[data-offline-banner][role="alert"]')!;
    expect(reconnecting.dataset.state).toBe("reconnecting");
    expect(reconnecting.querySelector("button")).toBeNull();
    act(() => root.render(<OfflineBanner onRetry={onRetry} reconnecting={false} />));
    const lost = host.querySelector<HTMLElement>('[data-offline-banner][role="alert"]')!;
    expect(lost.dataset.state).toBe("lost");
    act(() => lost.querySelector<HTMLButtonElement>("button")!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("draws one notice that follows the stream: none while connected, reconnecting, then lost", () => {
    const notices = () => [...host.querySelectorAll<HTMLElement>("[data-offline-banner]")].map((n) => n.dataset.state);
    useConnectionStore.getState().setGlobalStatus("connected");
    act(() => root.render(<OfflineNotice />));
    expect(notices()).toEqual([]);

    useConnectionStore.getState().setGlobalStatus("reconnecting");
    act(() => root.render(<OfflineNotice />));
    expect(notices()).toEqual(["reconnecting"]);

    useConnectionStore.getState().setGlobalStatus("failed");
    act(() => root.render(<OfflineNotice />));
    expect(notices()).toEqual(["lost"]);
  });
});
