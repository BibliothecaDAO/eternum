import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { openPlace } from "@/play/navigation/open-place";
import { requestLayerView } from "@/three/scenes/worldmap-layer-request";
import { MapViewControls } from "@/ui/features/world/containers/top-header/map-view-controls";
import {
  type ExpeditionRules,
  expeditionDayEndsAt,
  readExpeditionRules,
  seasonDay,
  setBlockTimestampSource,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { StructureType } from "@bibliothecadao/types";
import { nativeReleaseConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";

import { campBeside } from "../sites/site-fixture";

import { layerTab, layerViews, type MapLayers, useMapLayers } from "./map-layers";
import { PlaceNav } from "./place-nav";

const context = vi.hoisted(() => ({
  store: null as NativeFactStore | null,
  mapView: true,
  /** Herald's history read of the player's own stories (useStoryEvents); by default it failed, proving nothing. */
  history: {
    data: [] as object[],
    isPending: false,
    isError: true,
    holdsSince: undefined as number | undefined,
    completeThroughBlock: null as number | null,
  },
}));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: context.store } }) }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: context.mapView }) }));
vi.mock("@/hooks/store/use-story-events-store", () => ({
  useStoryEvents: () => ({ ...context.history, refetch: () => {} }),
}));
vi.mock("@/play/navigation/open-place", () => ({ openPlace: vi.fn() }));
vi.mock("@/three/scenes/worldmap-layer-request", () => ({ requestLayerView: vi.fn() }));

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
  setBlockTimestampSource(null);
  vi.clearAllMocks();
  context.history = { data: [], isPending: false, isError: true, holdsSince: undefined, completeThroughBlock: null };
  useAccountStore.setState({ account: null } as never);
  useConnectionStore.setState({ snapshotBlock: null });
});

/** The open list's choices, each by its word and whether it is the one shown. */
const openList = () =>
  [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((item) => [
    item.textContent,
    item.getAttribute("aria-checked"),
  ]);
const choose = (word: string) =>
  act(() =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="menu"] button')]
      .find((item) => item.textContent === word)!
      .click(),
  );

// A realm that has reached Ethereal I and II, the camera in Ethereal II.
const layersShowingII = (go: MapLayers["go"]): MapLayers => ({ layers: [0, 1, 2], shown: 2, go });

describe("the map's layers", () => {
  it("on a phone, the view slot names the layer shown and opens Realm, the world and each Ethereal layer", () => {
    const go = vi.fn();
    const onGo = vi.fn();
    const layers = layersShowingII(go);
    const views = layerViews(layers, { icon: "realm", go: () => onGo("realm") }, () => {});
    act(() => root.render(<PlaceNav place={null} onRealm={false} onGo={onGo} views={views} events={0} unread={0} />));
    const slot = host.querySelector<HTMLButtonElement>("[data-switch]")!;
    expect(slot.textContent).toBe("Ethereal II");
    expect(slot.querySelector("img")?.getAttribute("src")).toContain("depth-2");

    act(() => slot.click());
    expect(openList()).toEqual([
      ["Realm", "false"],
      ["World", "false"],
      ["Ethereal I", "false"],
      ["Ethereal II", "true"],
    ]);
    expect(onGo).not.toHaveBeenCalled();
    choose("Ethereal I");
    expect(go).toHaveBeenCalledWith(1);
    expect(openList()).toEqual([]);

    act(() => slot.click());
    choose("Ethereal II");
    expect(go).toHaveBeenCalledTimes(1);
    act(() => slot.click());
    choose("Realm");
    expect(onGo).toHaveBeenCalledWith("realm");
  });

  it("on a desktop, the World tab names the layer shown and opens the same layers, Realm staying its own tab", () => {
    const go = vi.fn();
    const onNavigate = vi.fn();
    const layers = layersShowingII(go);
    act(() =>
      root.render(
        <MapViewControls
          compact={false}
          isLocalView={false}
          canOpenLocal
          mapLayer={false}
          showLayerSwitch={false}
          worldTab={layerTab(layers)}
          onNavigate={onNavigate}
          onLayerChange={vi.fn()}
        />,
      ),
    );
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])).toEqual([
      ["Realm", "false"],
      ["Ethereal II", "true"],
    ]);

    act(() => tabs[1].click());
    expect(openList()).toEqual([
      ["World", "false"],
      ["Ethereal I", "false"],
      ["Ethereal II", "true"],
    ]);
    expect(onNavigate).not.toHaveBeenCalled();
    choose("World");
    expect(go).toHaveBeenCalledWith(0);

    act(() => tabs[0].click());
    expect(onNavigate).toHaveBeenCalledWith(false);
  });
});

/**
 * Realm 7's day with per-depth ruins and `reached` layers (Ethereal I and II by default, Ethereal III not yet), and its
 * army 201, the season's second day on the clock, so the first has clears of its own.
 */
const chestDay = (reached = 2) => {
  const { store } = campBeside();
  store.applyFacts([
    {
      model: "GameRelease",
      key: "0x1ab0",
      value: {
        game_id: 1,
        release_id: nativeReleaseConstants.RUIN_DEPTH_LIMIT_RELEASE,
        created_release_id: 3,
        preset_commitment: 0x1abn,
      },
    },
    // enter_depth records the deepest layer the realm has reached.
    {
      model: "Structure",
      key: "0x7",
      value: (() => {
        const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
        return { ...realm, metadata: { ...realm.metadata, deepest_depth: reached } };
      })(),
    },
  ] as never);
  context.store = store;
  const rules = readExpeditionRules(store, 1)!;
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const now = expeditionDayEndsAt(rules, rules.startMainAt) + 10;
  const today = seasonDay(rules, now)!;
  clockAt(store, now);
  return { store, realm, rules, now, today };
};

/**
 * The chain's clock at `seconds`, as the HUD reads it (useNowSeconds), the realm's site is placed by, and Herald's
 * snapshot scopes the store at: realm 7's player, so the store holds what that player's subscription holds.
 */
const clockAt = (store: NativeFactStore, seconds: number) =>
  act(() => {
    useChainTimeStore.getState().anchor({ timestamp: seconds * 1_000 });
    setBlockTimestampSource(() => seconds);
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: seconds });
  });

/** Today's discovery row for realm 7: whether any ruin was cleared today, as the contract writes it on every clear. */
const discovered = (store: NativeFactStore, day: number, ruinCleared: boolean) =>
  act(() =>
    store.applyFacts([
      {
        model: "ExpeditionDiscovery",
        key: `0x8${day}`,
        value: { game_id: 1, structure_id: 7n, epoch: BigInt(day), empty_reveals: 0, ruin_cleared: ruinCleared },
      },
    ] as never),
  );

/** A ruin cleared by `home` in the band of `day` at `depth`, in the home's own column: its site's clear receipt. */
const cleared = (store: NativeFactStore, rules: ExpeditionRules, home: number, day: number, depth: number) =>
  act(() => store.applyFacts([receipt(rules, home, day, depth)] as never));
/** The same receipt leaving the store, as Herald removes a row whose region leaves the subscription's scope. */
const outOfScope = (store: NativeFactStore, rules: ExpeditionRules, home: number, day: number, depth: number) =>
  act(() => store.applyFacts([{ ...receipt(rules, home, day, depth), value: null }] as never));
const receipt = (rules: ExpeditionRules, home: number, day: number, depth: number) => ({
  model: "ExpeditionSite",
  key: `0x9${home}${day}${depth}`,
  value: {
    game_id: 1,
    entity_id: BigInt(9_000 + home * 100 + day * 10 + depth),
    category: StructureType.Ruin,
    initial_guard_count: 999n,
    alt: false,
    col: (home - 1) * rules.spacing + 1,
    row: (day * 4 + depth) * rules.spacing + 1,
    clear: { explorer_id: 201n, home_id: BigInt(home), reward: null },
  },
});

/**
 * Realm 7's army 201 moved into its own column at `depth` today, which brings that layer's region into scope: its tile
 * row leaves and the new one comes, as Herald sends a move.
 */
const armyIn = (store: NativeFactStore, rules: ExpeditionRules, today: number, depth: number) =>
  act(() => {
    const tile = [...store.entries("TileOccupancy")].find(([, row]) => row.entity_id === 201n)![1];
    const key = `0x75${today}${depth}`;
    store.applyFacts([
      { model: "TileOccupancy", key: armyTileKeys.get(store) ?? SITE_FIXTURE_ARMY_TILE_KEY, value: null },
      {
        model: "TileOccupancy",
        key,
        value: { ...tile, col: 6 * rules.spacing + 2, row: (today * 4 + depth) * rules.spacing + 2 },
      },
    ] as never);
    armyTileKeys.set(store, key);
  });
/** The army's tile row as Herald keys it on the wire (site-fixture's, then each move's): a move removes it by this key. */
const SITE_FIXTURE_ARMY_TILE_KEY = "0x75";
const armyTileKeys = new WeakMap<NativeFactStore, string>();

/** The switch of the HUD over the real layers: the desktop's World tab, or a phone's view slot. */
const LayerSwitch = ({
  rules,
  realm,
  phone,
  toRealm = () => {},
  chosen = () => {},
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  phone?: boolean;
  toRealm?: () => void;
  chosen?: () => void;
}) => {
  const layers = useMapLayers(rules, realm, realm);
  if (!layers) return null;
  return phone ? (
    <PlaceNav
      place={null}
      onRealm={!context.mapView}
      onGo={() => {}}
      views={layerViews(layers, { icon: "realm", go: toRealm }, chosen)}
      events={0}
      unread={0}
    />
  ) : (
    <MapViewControls
      compact={false}
      isLocalView={!context.mapView}
      canOpenLocal
      mapLayer={false}
      showLayerSwitch={false}
      worldTab={layerTab(layers)}
      onNavigate={() => {}}
      onLayerChange={() => {}}
    />
  );
};

/** The switch's four marks, each layer's chest as it says it. */
const switchMarks = () =>
  [...host.querySelectorAll(".ui-layer-chests [data-chest]")].map((mark) => mark.getAttribute("aria-label"));
/** The open list's rows: each layer's word, whether it is checked, and the chest ending its row. */
const listRows = () =>
  [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((item) => [
    item.textContent,
    item.getAttribute("aria-checked"),
    item.querySelector("[data-chest]")?.getAttribute("data-chest") ?? null,
  ]);

describe("each layer's ruin chest today, on the layer switch", () => {
  it("opens every reached layer while nothing was cleared today, marks today's clears, and opens again tomorrow", () => {
    const { store, realm, rules, now, today } = chestDay();
    expect(today).toBe(1);
    discovered(store, today, false);
    // Another realm's clear, and realm 7's own of the day before, take nothing of today's.
    cleared(store, rules, 8, today, 1);
    cleared(store, rules, 7, today - 1, 2);
    context.mapView = true;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    expect(switchMarks()).toEqual([
      "World: chest to take today",
      "Ethereal I: chest to take today",
      "Ethereal II: chest to take today",
      "Ethereal III: not reached yet",
    ]);

    // Realm 7 clears today's Surface ruin: its region is the home's own, always held.
    discovered(store, today, true);
    cleared(store, rules, 7, today, 0);
    act(() => host.querySelector<HTMLButtonElement>('[role="tab"][aria-haspopup]')!.click());
    expect(listRows()).toEqual([
      ["World", "true", "claimed"],
      ["Ethereal I", "false", "unknown"],
      ["Ethereal II", "false", "unknown"],
    ]);
    choose("Ethereal II");
    expect(requestLayerView).toHaveBeenCalledTimes(1);

    // The day turns: tomorrow's discovery holds no clear, so every reached layer has its chest again.
    clockAt(store, expeditionDayEndsAt(rules, now) + 1);
    expect(switchMarks()).toEqual([
      "World: chest to take today",
      "Ethereal I: chest to take today",
      "Ethereal II: chest to take today",
      "Ethereal III: not reached yet",
    ]);
  });

  it("never reopens a taken chest whose layer's receipts leave the scope: it reads unknown until an army is there", () => {
    const { store, realm, rules, today } = chestDay();
    discovered(store, today, true);
    armyIn(store, rules, today, 1);
    cleared(store, rules, 7, today, 1);
    context.mapView = true;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    expect(switchMarks()[1]).toBe("Ethereal I: chest taken today");

    // The army leaves Ethereal I: the subscription drops that region, and Herald removes its receipt.
    armyIn(store, rules, today, 2);
    outOfScope(store, rules, 7, today, 1);
    expect(switchMarks()).toEqual([
      "World: chest to take today",
      "Ethereal I: chest not known without an army there",
      "Ethereal II: chest to take today",
      "Ethereal III: not reached yet",
    ]);

    // A fresh snapshot of that scope never had the receipt: the same marks.
    act(() => root.unmount());
    root = createRoot(host);
    const fresh = chestDay();
    discovered(fresh.store, fresh.today, true);
    armyIn(fresh.store, fresh.rules, fresh.today, 2);
    act(() => root.render(<LayerSwitch rules={fresh.rules} realm={fresh.realm} />));
    expect(switchMarks()[1]).toBe("Ethereal I: chest not known without an army there");
  });

  it("reads today's clears from the player's whole history of the day: no layer is unknown, wherever the armies are", () => {
    const { store, realm, rules, now, today } = chestDay();
    discovered(store, today, true);
    // Ethereal I cleared earlier today; its army left, and Herald removed the receipt from the store.
    wholeHistory(rules, now, [ruinPayout(rules, now, today, 1, "0xc1")]);
    context.mapView = true;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    expect(switchMarks()).toEqual([
      "World: chest to take today",
      "Ethereal I: chest taken today",
      "Ethereal II: chest to take today",
      "Ethereal III: not reached yet",
    ]);
  });

  it("opens nothing from a history that lacks the day's start or a payout's battle", () => {
    const { store, realm, rules, now, today } = chestDay();
    discovered(store, today, true);
    const [payout, battle] = ruinPayout(rules, now, today, 1, "0xc1");
    // The battle that placed the payout is missing: the payout cannot be put on a layer.
    wholeHistory(rules, now, [[payout!]]);
    context.mapView = true;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    expect(switchMarks()[1]).toBe("Ethereal I: chest not known without an army there");

    // The read holds only stories after the day began: the clear it places is taken, but it opens nothing.
    act(() => {
      context.history = { ...context.history, data: [payout!, battle!], holdsSince: now };
      root.render(<LayerSwitch rules={rules} realm={realm} />);
    });
    expect(switchMarks().slice(1, 3)).toEqual([
      "Ethereal I: chest taken today",
      "Ethereal II: chest not known without an army there",
    ]);
  });

  it("never opens from a history behind the snapshot, of unknown coverage, or held over a reconnect", () => {
    const { store, realm, rules, now, today } = chestDay();
    // Ethereal I cleared today: its receipt left with its army; the discovery row says a ruin was cleared.
    discovered(store, today, true);
    context.mapView = true;
    const unknownI = "Ethereal I: chest not known without an army there";

    // An empty history complete only through block 10, behind the snapshot's block 20.
    wholeHistory(rules, now, [], 10);
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    expect(switchMarks()[1]).toBe(unknownI);

    // Herald does not say how far its history is complete.
    wholeHistory(rules, now, [], null);
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    expect(switchMarks()[1]).toBe(unknownI);

    // A reconnect: the new snapshot is at block 30, the cached history still through 20 with Ethereal II's clear.
    wholeHistory(rules, now, [ruinPayout(rules, now, today, 2, "0xc2")]);
    act(() => {
      useConnectionStore.setState({ snapshotBlock: 30 });
      root.render(<LayerSwitch rules={rules} realm={realm} />);
    });
    expect(switchMarks().slice(1, 3)).toEqual([unknownI, "Ethereal II: chest taken today"]);
  });

  it("never opens a layer whose clear lands after the history read, until its story arrives", () => {
    const { store, realm, rules, now, today } = chestDay();
    discovered(store, today, false);
    wholeHistory(rules, now, []);
    context.mapView = true;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    expect(switchMarks()[1]).toBe("Ethereal I: chest to take today");

    // Ethereal I is cleared after the read: the discovery row has it, the history not yet, no receipt in scope.
    discovered(store, today, true);
    expect(switchMarks()[1]).toBe("Ethereal I: chest not known without an army there");

    // The stream brings its payout and battle into the read: taken, and the others proven open again.
    act(() => {
      context.history = { ...context.history, data: ruinPayout(rules, now, today, 1, "0xc3") };
      root.render(<LayerSwitch rules={rules} realm={realm} />);
    });
    expect(switchMarks()).toEqual([
      "World: chest to take today",
      "Ethereal I: chest taken today",
      "Ethereal II: chest to take today",
      "Ethereal III: not reached yet",
    ]);
  });

  it.each([
    ["a desktop", false],
    ["a phone", true],
  ])(
    "on %s before Ethereal I, the switch stays Realm / World and carries the Surface's chest and three locks",
    (_, phone) => {
      const { store, realm, rules, today } = chestDay(0);
      discovered(store, today, false);
      context.mapView = true;
      act(() => root.render(<LayerSwitch rules={rules} realm={realm} phone={phone} />));
      expect(switchMarks()).toEqual([
        "World: chest to take today",
        "Ethereal I: not reached yet",
        "Ethereal II: not reached yet",
        "Ethereal III: not reached yet",
      ]);
      expect(host.querySelector("[aria-haspopup]")).toBeNull();

      discovered(store, today, true);
      cleared(store, rules, 7, today, 0);
      expect(switchMarks()[0]).toBe("World: chest taken today");
    },
  );

  it("opens the same list from the realm's view, where a layer opens the map at the realm's site in it", () => {
    const { store, realm, rules, today } = chestDay();
    discovered(store, today, true);
    armyIn(store, rules, today, 1);
    cleared(store, rules, 7, today, 1);
    context.mapView = false;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])).toEqual([
      ["Realm", "true"],
      ["World", "false"],
    ]);
    expect(switchMarks()[1]).toBe("Ethereal I: chest taken today");

    act(() => tabs[1]!.click());
    expect(listRows()).toEqual([
      ["World", "false", "open"],
      ["Ethereal I", "false", "claimed"],
      ["Ethereal II", "false", "unknown"],
    ]);
    choose("Ethereal II");
    expect(requestLayerView).not.toHaveBeenCalled();
    expect(openPlace).toHaveBeenCalledTimes(1);
    const [scene, position] = vi.mocked(openPlace).mock.calls[0]!;
    const { y } = position.getContract();
    expect([scene, Math.floor(y / rules.spacing) % 4, Math.floor(Math.floor(y / rules.spacing) / 4)]).toEqual([
      "map",
      2,
      today,
    ]);
  });

  it("on a phone in the realm's view, the view slot carries the marks and lists Realm checked, then each layer", () => {
    const { store, realm, rules, today } = chestDay();
    discovered(store, today, false);
    context.mapView = false;
    const toRealm = vi.fn();
    const chosen = vi.fn();
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} phone toRealm={toRealm} chosen={chosen} />));
    const slot = host.querySelector<HTMLButtonElement>("[data-switch]")!;
    expect(slot.textContent).toBe("World");
    expect(switchMarks()).toHaveLength(4);

    act(() => slot.click());
    expect(listRows()).toEqual([
      ["Realm", "true", null],
      ["World", "false", "open"],
      ["Ethereal I", "false", "open"],
      ["Ethereal II", "false", "open"],
    ]);
    choose("Realm");
    expect([toRealm.mock.calls.length, chosen.mock.calls.length]).toEqual([0, 1]);
    act(() => slot.click());
    choose("Ethereal I");
    expect(openPlace).toHaveBeenCalledTimes(1);
  });
});

/**
 * Realm 7's player signed in, the store's snapshot at block 20, and Herald's history of their stories holding the
 * whole day (read from before it began) through `through` (the snapshot's block by default).
 */
const wholeHistory = (
  rules: ExpeditionRules,
  now: number,
  stories: object[][],
  through: number | null = SNAPSHOT_BLOCK,
) => {
  useAccountStore.setState({ account: { address: "0x111" } } as never);
  useConnectionStore.setState({ snapshotBlock: SNAPSHOT_BLOCK });
  const start = expeditionDayEndsAt(rules, rules.startMainAt);
  context.history = {
    data: stories.flat(),
    isPending: false,
    isError: false,
    holdsSince: start - 1,
    completeThroughBlock: through,
  };
  expect(now).toBeGreaterThan(start);
};
const SNAPSHOT_BLOCK = 20;

/** A ruin's payout to realm 7 today at `depth`, and the battle that won it in the same transaction, as history reads them. */
const ruinPayout = (rules: ExpeditionRules, now: number, today: number, depth: number, tx: string) => {
  const story = (kind: string, storyPayload: object) => ({
    story: kind,
    storyPayload,
    tx_hash: tx,
    owner: "0x111",
    timestampMs: (now - 5) * 1_000,
    timestamp: String(now - 5),
  });
  return [
    story("SitePayout", { structure_id: 7, explorer_id: 201, site_id: 9_301, category: StructureType.Ruin }),
    story("BattleEvent", {
      defender_id: 9_301,
      coord: { x: 6 * rules.spacing + 3, y: (today * 4 + depth) * rules.spacing + 3 },
    }),
  ];
};
