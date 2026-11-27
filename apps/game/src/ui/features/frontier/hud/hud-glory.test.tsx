import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dayAtIndex, readExpeditionRules } from "@bibliothecadao/eternum";
import { ownRaceGlory, readDeepSites, readRaceBoard, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { deepSites, formatShort, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { wire } from "@/lab/game/lab-chain";
import { raceScenario } from "@/lab/game/race-scenario";
import { HUD_GLORY_WORDS, SEASON } from "@/ui/design-system/kit/words";
import { OpeningProvider } from "../opening/opening-context";
import { FrontierPlaces } from "./frontier-desktop";
import { hudGloryTip, readActiveGloryPerMinute, readHudGlory, showHudGlory, type HudGloryState } from "./hud-glory";
import { TopBarView } from "./phone-top-bar";

vi.mock("@/ui/features/event-feed/quick-feed", () => ({
  FeedToasts: () => null,
  useUnreadImportantCount: () => 0,
}));

const GAME_ID = 1;
const OWN_HOME = 7n;
const ALLY_HOME = 9n;
const UNIT = BigInt(RESOURCE_PRECISION);

function siteIdOf(key: (typeof deepSites)[number]["key"]): bigint {
  return BigInt(800 + deepSites.find((site) => site.key === key)!.id);
}

function setGuard(
  store: NativeFactStore,
  siteId: bigint,
  slot: number,
  home: bigint,
  troopsCount: bigint,
  tag: string,
) {
  const sample = [...store.inGame("ExplorerTroops", GAME_ID)][0]!;
  const slotKey = store.wireKeyOf("GarrisonSlot", { game_id: GAME_ID, structure_id: siteId, slot }) ?? `0xf10${tag}`;
  const guardKey = store.wireKeyOf("Guard", { game_id: GAME_ID, structure_id: siteId, slot }) ?? `0xf20${tag}`;
  store.applyFacts([
    {
      model: "GarrisonSlot",
      key: slotKey,
      value: { game_id: GAME_ID, structure_id: String(siteId), slot, home: String(home) },
    },
    {
      model: "Guard",
      key: guardKey,
      value: wire({
        game_id: GAME_ID,
        structure_id: siteId,
        slot,
        troops: { ...sample.troops, count: troopsCount },
        destroyed_tick: 0,
      }),
    },
  ] as never);
}

function claimSiteWithoutGuards(store: NativeFactStore, siteId: bigint) {
  const site = store.require("DeepSite", { game_id: GAME_ID, entity_id: siteId });
  const structure = store.require("Structure", { game_id: GAME_ID, entity_id: siteId });
  const own = store.require("Structure", { game_id: GAME_ID, entity_id: OWN_HOME });
  const beastKey = store.wireKeyOf("Guard", { game_id: GAME_ID, structure_id: siteId, slot: 0 });
  store.applyFacts([
    {
      model: "DeepSite",
      key: store.wireKeyOf("DeepSite", site)!,
      value: wire({ ...site, aspect: 1 }),
    },
    {
      model: "Structure",
      key: store.wireKeyOf("Structure", structure)!,
      value: wire({ ...structure, owner: own.owner }),
    },
    ...(beastKey ? [{ model: "Guard", key: beastKey, value: null }] : []),
  ] as never);
}

function clearAltarGuards(store: NativeFactStore) {
  const altar = siteIdOf("altar");
  const slotKey = store.wireKeyOf("GarrisonSlot", { game_id: GAME_ID, structure_id: altar, slot: 1 })!;
  const guardKey = store.wireKeyOf("Guard", { game_id: GAME_ID, structure_id: altar, slot: 1 })!;
  store.applyFacts([
    { model: "GarrisonSlot", key: slotKey, value: null },
    { model: "Guard", key: guardKey, value: null },
  ] as never);
}

function setConfirmedGlory(store: NativeFactStore, wholeGlory: number) {
  const member = store.require("RaceMember", { game_id: GAME_ID, entity_id: OWN_HOME });
  store.applyFacts([
    {
      model: "RaceMember",
      key: store.wireKeyOf("RaceMember", member)!,
      value: wire({ ...member, glory: BigInt(wholeGlory) * UNIT }),
    },
  ] as never);
}

describe("HUD Glory reader", () => {
  it("reads confirmed Glory from the same board source and keeps it confirmed-only across ticks", () => {
    const scenario = raceScenario();
    const { store, startsAt } = scenario;
    const altar = siteIdOf("altar");
    clearAltarGuards(store);
    setGuard(store, altar, 0, OWN_HOME, 500n * UNIT, "a");

    const interval = Number(store.require("SliceRules", { game_id: GAME_ID }).tick_config.armies_tick_in_seconds);
    const board = readRaceBoard(store, GAME_ID, OWN_HOME);
    expect(board.known?.race).toBeTruthy();
    const race = board.known!.race!;

    const atStart = readHudGlory(race, store, GAME_ID, OWN_HOME, startsAt)!;
    const later = readHudGlory(race, store, GAME_ID, OWN_HOME, startsAt + interval * 5)!;
    const expectedPay = readDeepSites(store, startsAt, GAME_ID).find((site) => site.id === altar)!.buildingPay;

    expect(atStart.glory).toBe(ownRaceGlory(race));
    expect(atStart.glory).toBe(1250);
    expect(later.glory).toBe(1250);
    expect(atStart.active).toBe(true);
    expect(atStart.earningPerMin).toBeCloseTo(expectedPay * (60 / interval), 6);
  });

  it("reports zero earning rate for owned-but-undefended 0-guard sites and ally-only sites", () => {
    const scenario = raceScenario();
    const { store, startsAt } = scenario;
    const race = readRaceBoard(store, GAME_ID, OWN_HOME).known!.race!;

    const allyOnly = readHudGlory(race, store, GAME_ID, OWN_HOME, startsAt)!;
    expect(allyOnly).toEqual({ glory: 1250, earningPerMin: 0, active: false });

    clearAltarGuards(store);
    const undefended = readHudGlory(race, store, GAME_ID, OWN_HOME, startsAt)!;
    expect(undefended).toEqual({ glory: 1250, earningPerMin: 0, active: false });
  });

  it("splits active Glory rate by next-tick surviving troops across Foundation and Altar, ignoring Core and Mine", () => {
    const scenario = raceScenario();
    const { store, startsAt } = scenario;
    const foundation = siteIdOf("foundation");
    const core = siteIdOf("core");
    const mine = siteIdOf("mine");
    const loss = store.require("DeepRules", { game_id: GAME_ID }).loss_per_tick;
    const interval = Number(store.require("SliceRules", { game_id: GAME_ID }).tick_config.armies_tick_in_seconds);

    claimSiteWithoutGuards(store, foundation);
    claimSiteWithoutGuards(store, core);
    claimSiteWithoutGuards(store, mine);
    setGuard(store, core, 0, OWN_HOME, 300n * UNIT, "10");
    setGuard(store, mine, 0, OWN_HOME, 300n * UNIT, "11");
    expect(readActiveGloryPerMinute(store, GAME_ID, OWN_HOME, startsAt)).toBe(0);

    setGuard(store, foundation, 0, OWN_HOME, 100n * UNIT + loss, "12");
    setGuard(store, foundation, 1, ALLY_HOME, 300n * UNIT + loss, "13");
    const pay = readDeepSites(store, startsAt, GAME_ID).find((site) => site.id === foundation)!.buildingPay;
    const rate = readActiveGloryPerMinute(store, GAME_ID, OWN_HOME, startsAt);
    expect(rate).toBeCloseTo(pay * 0.25 * (60 / interval), 6);
  });

  it("drops active earning rate to zero when guards die on the next tick, after day-end, or when race ends", () => {
    const scenario = raceScenario();
    const { store, startsAt } = scenario;
    const altar = siteIdOf("altar");
    const loss = store.require("DeepRules", { game_id: GAME_ID }).loss_per_tick;
    clearAltarGuards(store);

    setGuard(store, altar, 0, OWN_HOME, loss, "20");
    expect(readActiveGloryPerMinute(store, GAME_ID, OWN_HOME, startsAt)).toBe(0);

    setGuard(store, altar, 0, OWN_HOME, 1000n * UNIT, "21");
    expect(readActiveGloryPerMinute(store, GAME_ID, OWN_HOME, startsAt)).toBeGreaterThan(0);

    const calendar = readExpeditionRules(store, GAME_ID)!;
    const dayEnd = dayAtIndex(calendar, 0).end;
    expect(readActiveGloryPerMinute(store, GAME_ID, OWN_HOME, dayEnd)).toBe(0);

    const finished = raceScenario(true);
    clearAltarGuards(finished.store);
    setGuard(finished.store, altar, 0, OWN_HOME, 1000n * UNIT, "22");
    expect(readActiveGloryPerMinute(finished.store, GAME_ID, OWN_HOME, finished.startsAt)).toBe(0);
  });

  it("hides HUD Glory indicator at 0 confirmed Glory unless actively earning", () => {
    const scenario = raceScenario();
    const { store, startsAt } = scenario;
    setConfirmedGlory(store, 0);
    const race = readRaceBoard(store, GAME_ID, OWN_HOME).known!.race!;

    const idleZero = readHudGlory(race, store, GAME_ID, OWN_HOME, startsAt)!;
    expect(idleZero).toEqual({ glory: 0, earningPerMin: 0, active: false });
    expect(showHudGlory(idleZero)).toBe(false);

    clearAltarGuards(store);
    setGuard(store, siteIdOf("altar"), 0, OWN_HOME, 500n * UNIT, "30");
    const earningZero = readHudGlory(race, store, GAME_ID, OWN_HOME, startsAt)!;
    expect(earningZero.glory).toBe(0);
    expect(earningZero.active).toBe(true);
    expect(showHudGlory(earningZero)).toBe(true);
    expect(readHudGlory(null, store, GAME_ID, OWN_HOME, startsAt)).toBeNull();
    expect(readHudGlory(race, store, GAME_ID, null, startsAt)).toBeNull();
  });
});

describe("HUD Glory Option A surfaces", () => {
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

  const renderDesktop = (glory: HudGloryState | null, onSurface = vi.fn()) => {
    act(() =>
      root.render(
        <OpeningProvider opened={new Set(["essence"])}>
          <FrontierPlaces surface={null} onSurface={onSurface} research={false} glory={glory} />
        </OpeningProvider>,
      ),
    );
    return {
      onSurface,
      season: host.querySelector<HTMLButtonElement>(`nav[aria-label="Places"] button[aria-label="${SEASON}"]`)!,
    };
  };

  it("renders plain Season on desktop at 0 Glory and not earning", () => {
    const { season } = renderDesktop({ glory: 0, earningPerMin: 0, active: false });
    expect(season.getAttribute("data-glory")).toBeNull();
    expect(season.getAttribute("data-tip")).toBeNull();
    expect(season.querySelector("[data-glory-value]")).toBeNull();
    expect(season.querySelector("[data-glory-live]")).toBeNull();
    expect(season.textContent).toBe(SEASON);
  });

  it("renders confirmed Glory inside Season button without emerald dot when idle, and opens Season on click", () => {
    const state: HudGloryState = { glory: 148, earningPerMin: 0, active: false };
    const { season, onSurface } = renderDesktop(state);
    expect(season.getAttribute("data-glory")).toBe("true");
    expect(season.querySelector("[data-glory-value]")?.textContent).toBe(formatShort(148));
    expect(season.querySelector("[data-glory-live]")).toBeNull();
    expect(season.getAttribute("data-tip")).toBe(HUD_GLORY_WORDS.tip(148));
    expect(hudGloryTip(state)).toBe(HUD_GLORY_WORDS.tip(148));
    act(() => season.click());
    expect(onSurface).toHaveBeenCalledWith("season");
  });

  it("renders live emerald dot and per-minute hover rate on desktop only while actively earning", () => {
    const state: HudGloryState = { glory: 148, earningPerMin: 3.9, active: true };
    const { season } = renderDesktop(state);
    expect(season.getAttribute("data-glory")).toBe("true");
    expect(season.querySelector("[data-glory-value]")?.textContent).toBe(formatShort(148));
    expect(season.querySelector("[data-glory-live]")).not.toBeNull();
    expect(season.getAttribute("data-tip")).toBe(HUD_GLORY_WORDS.earningTip(148, 3.9));
  });

  it("renders compact crown + Glory pill in phone top bar, with live dot only while earning, opening Season directly", () => {
    const onOpen = vi.fn();
    const stocks = {
      stores: [
        { kind: "essence" as const, amount: 1200, limit: undefined, tone: "calm" as const, flyTarget: "essence" },
      ],
    };

    act(() => root.render(<TopBarView stocks={stocks} clock={<span>D15</span>} />));
    expect(host.querySelector(".frontier-bar__glory")).toBeNull();

    const idle: HudGloryState = { glory: 148, earningPerMin: 0, active: false };
    act(() =>
      root.render(
        <TopBarView stocks={stocks} clock={<span>D15</span>} season={{ glory: idle, open: false, onOpen }} />,
      ),
    );
    const idlePill = host.querySelector<HTMLButtonElement>(".frontier-bar__glory")!;
    expect(idlePill.getAttribute("aria-label")).toBe(SEASON);
    expect(idlePill.querySelector("[data-glory-value]")?.textContent).toBe(formatShort(148));
    expect(idlePill.querySelector("[data-glory-live]")).toBeNull();
    expect(idlePill.getAttribute("data-tip")).toBe(HUD_GLORY_WORDS.tip(148));

    const earning: HudGloryState = { glory: 148, earningPerMin: 3.9, active: true };
    act(() =>
      root.render(
        <TopBarView stocks={stocks} clock={<span>D15</span>} season={{ glory: earning, open: false, onOpen }} />,
      ),
    );
    const livePill = host.querySelector<HTMLButtonElement>(".frontier-bar__glory")!;
    expect(livePill.querySelector("[data-glory-value]")?.textContent).toBe(formatShort(148));
    expect(livePill.querySelector("[data-glory-live]")).not.toBeNull();
    expect(livePill.getAttribute("data-tip")).toBe(HUD_GLORY_WORDS.earningTip(148, 3.9));
    act(() => livePill.click());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
