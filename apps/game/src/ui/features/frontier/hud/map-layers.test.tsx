import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
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

import { frontierDay } from "../deploy/deploy-fixture";

import { layerTab, layerViews, type MapLayers, useMapLayers } from "./map-layers";
import { PlaceNav } from "./place-nav";

const context = vi.hoisted(() => ({ store: null as NativeFactStore | null, mapView: true }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: context.store } }) }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: context.mapView }) }));
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

// A realm with Ethereal I and II researched, the camera in Ethereal II.
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

/** Realm 7's day, with per-depth ruins and Ethereal I and II researched: Ethereal III stays locked. */
const chestDay = () => {
  const { store, row: realm } = frontierDay();
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
    { model: "RealmKnowledge", key: "0xd", value: { game_id: 1, structure_id: 7, learned: 2n << 48n } },
  ] as never);
  context.store = store;
  const rules = readExpeditionRules(store, 1)!;
  return { store, realm, rules };
};

/** The chain's clock at `seconds`, as the HUD reads it (useNowSeconds) and the realm's site is placed by. */
const clockAt = (seconds: number) =>
  act(() => {
    useChainTimeStore.getState().anchor({ timestamp: seconds * 1_000 });
    setBlockTimestampSource(() => seconds);
  });

/** A ruin cleared by `home` in the band of `day` at `depth`: its site's clear receipt naming the home. */
const cleared = (store: NativeFactStore, rules: ExpeditionRules, home: number, day: number, depth: number) =>
  act(() =>
    store.applyFacts([
      {
        model: "ExpeditionSite",
        key: `0x9${home}${day}${depth}`,
        value: {
          game_id: 1,
          entity_id: BigInt(9_000 + home * 100 + day * 10 + depth),
          category: StructureType.Ruin,
          initial_guard_count: 999n,
          alt: false,
          col: 15,
          row: (day * 4 + depth) * rules.spacing + 1,
          clear: { explorer_id: 201n, home_id: BigInt(home), reward: null },
        },
      },
    ] as never),
  );

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
  it("marks each layer claimed, open or locked from today's clears, and opens the next day's chests", () => {
    const { store, realm, rules } = chestDay();
    // The season's second day, so the first has clears of its own.
    const now = expeditionDayEndsAt(rules, rules.startMainAt) + 10;
    clockAt(now);
    const today = seasonDay(rules, now)!;
    expect(today).toBe(1);
    cleared(store, rules, 7, today, 0);
    // Another realm's clear, and realm 7's own of the day before, take nothing of today's.
    cleared(store, rules, 8, today, 1);
    cleared(store, rules, 7, today - 1, 2);
    context.mapView = true;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    expect(switchMarks()).toEqual([
      "World: chest taken today",
      "Ethereal I: chest to take today",
      "Ethereal II: chest to take today",
      "Ethereal III: not researched",
    ]);

    act(() => host.querySelector<HTMLButtonElement>('[role="tab"][aria-haspopup]')!.click());
    expect(listRows()).toEqual([
      ["World", "true", "claimed"],
      ["Ethereal I", "false", "open"],
      ["Ethereal II", "false", "open"],
    ]);
    choose("Ethereal II");
    expect(requestLayerView).toHaveBeenCalledTimes(1);

    cleared(store, rules, 7, today, 2);
    expect(switchMarks()[2]).toBe("Ethereal II: chest taken today");

    // The day turns: yesterday's clears close nothing, every researched layer has its chest again.
    clockAt(expeditionDayEndsAt(rules, now) + 1);
    expect(switchMarks()).toEqual([
      "World: chest to take today",
      "Ethereal I: chest to take today",
      "Ethereal II: chest to take today",
      "Ethereal III: not researched",
    ]);
  });

  it("opens the same list from the realm's view, where a layer opens the map at the realm's site in it", () => {
    const { store, realm, rules } = chestDay();
    const now = rules.startMainAt + 10;
    clockAt(now);
    cleared(store, rules, 7, seasonDay(rules, now)!, 1);
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
      ["Ethereal II", "false", "open"],
    ]);
    choose("Ethereal II");
    expect(requestLayerView).not.toHaveBeenCalled();
    expect(openPlace).toHaveBeenCalledTimes(1);
    const [scene, position] = vi.mocked(openPlace).mock.calls[0]!;
    const { y } = position.getContract();
    expect([scene, Math.floor(y / rules.spacing) % 4, Math.floor(Math.floor(y / rules.spacing) / 4)]).toEqual([
      "map",
      2,
      seasonDay(rules, now),
    ]);
  });

  it("on a phone in the realm's view, the view slot carries the marks and lists Realm checked, then each layer", () => {
    const { realm, rules } = chestDay();
    clockAt(rules.startMainAt + 10);
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
