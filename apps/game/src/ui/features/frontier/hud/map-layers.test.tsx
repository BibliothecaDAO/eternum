import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
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
import { deepCenter, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { campBeside } from "../sites/site-fixture";

import { layerTab, layerViews, type MapLayers, useMapLayers } from "./map-layers";
import { PlaceNav } from "./place-nav";

const context = vi.hoisted(() => ({
  store: null as NativeFactStore | null,
  mapView: true,
}));
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
    expect(slot.textContent).toBe("Hollow");
    expect(slot.querySelector("img")?.getAttribute("src")).toContain("depth-2");

    act(() => slot.click());
    expect(openList()).toEqual([
      ["Realm", "false"],
      ["Surface", "false"],
      ["Veil", "false"],
      ["Hollow", "true"],
    ]);
    expect(onGo).not.toHaveBeenCalled();
    choose("Veil");
    expect(go).toHaveBeenCalledWith(1);
    expect(openList()).toEqual([]);

    act(() => slot.click());
    choose("Hollow");
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
      ["Hollow", "true"],
    ]);

    act(() => tabs[1].click());
    expect(openList()).toEqual([
      ["Surface", "false"],
      ["Veil", "false"],
      ["Hollow", "true"],
    ]);
    expect(onNavigate).not.toHaveBeenCalled();
    choose("Surface");
    expect(go).toHaveBeenCalledWith(0);

    act(() => tabs[0].click());
    expect(onNavigate).toHaveBeenCalledWith(false);
  });
});

const researchedDay = (researched = 3n) => {
  const { store } = campBeside();
  store.applyFacts([
    { model: "RealmKnowledge", key: "0xd", value: { game_id: 1, structure_id: 7, learned: researched << 48n } },
  ] as never);
  context.store = store;
  const rules = readExpeditionRules(store, 1)!;
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const now = expeditionDayEndsAt(rules, rules.startMainAt) + 10;
  const today = seasonDay(rules, now)!;
  clockAt(store, now);
  return { store, realm, rules, today };
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

const listRows = () =>
  [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((item) => [
    item.textContent,
    item.getAttribute("aria-checked"),
  ]);

describe("the layer switch over the real layers", () => {
  it.each([
    ["a desktop", false],
    ["a phone", true],
  ])("on %s before Veil, the switch stays Realm / World with no list", (_, phone) => {
    const { rules, realm } = researchedDay(0n);
    context.mapView = true;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} phone={phone} />));
    expect(host.querySelector("[aria-haspopup]")).toBeNull();
  });

  it("opens the same list from the realm's view, where a layer opens the map at the realm's site in it", () => {
    const { realm, rules, today } = researchedDay();
    context.mapView = false;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])).toEqual([
      ["Realm", "true"],
      ["Surface", "false"],
    ]);

    act(() => tabs[1]!.click());
    expect(listRows()).toEqual([
      ["Surface", "false"],
      ["Veil", "false"],
      ["Hollow", "false"],
      ["Deep", "false"],
    ]);
    choose("Hollow");
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

  it("on a phone in the realm's view, the view slot lists Realm checked, then each layer", () => {
    const { realm, rules } = researchedDay();
    context.mapView = false;
    const toRealm = vi.fn();
    const chosen = vi.fn();
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} phone toRealm={toRealm} chosen={chosen} />));
    const slot = host.querySelector<HTMLButtonElement>("[data-switch]")!;
    expect(slot.textContent).toBe("Surface");

    act(() => slot.click());
    expect(listRows()).toEqual([
      ["Realm", "true"],
      ["Surface", "false"],
      ["Veil", "false"],
      ["Hollow", "false"],
      ["Deep", "false"],
    ]);
    choose("Realm");
    expect([toRealm.mock.calls.length, chosen.mock.calls.length]).toEqual([0, 1]);
    act(() => slot.click());
    choose("Veil");
    expect(openPlace).toHaveBeenCalledTimes(1);
  });
});

const DEEP_RULES = {
  game_id: 1,
  gate_distance: 4,
  rings: [{ radius: 5, realms: 0 }],
  beasts: [
    { count: 1000n, bow: false },
    { count: 1000n, bow: true },
    { count: 1000n, bow: false },
    { count: 1000n, bow: true },
  ],
  loss_per_tick: 1n,
  core_per_tick: 1n,
  mine_per_tick: 1n,
  building_pay: { alone: 1, pair: 1, crowd: 1 },
  altar_threshold: 10,
};

describe("the shared Deep in the map layer menu", () => {
  it("shows Deep and visits its shared center", () => {
    const { store, realm } = researchedDay(3n);
    store.applyFacts([
      {
        model: "SettlementRules",
        key: "0x2",
        value: { ...store.require("SettlementRules", { game_id: 1 }), spacing: 1024 },
      },
      { model: "DeepRules", key: "0xdeef", value: DEEP_RULES },
    ] as never);
    const rules = readExpeditionRules(store, 1)!;
    context.mapView = true;
    useUIStore.setState({ cameraTargetHex: { col: 512, row: 512 } });
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    const open = () => act(() => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][1]!.click());
    open();
    expect(listRows().map(([label]) => label)).toEqual(["Surface", "Veil", "Hollow", "Deep"]);
    choose("Deep");
    expect(requestLayerView).toHaveBeenCalledTimes(1);
    expect(requestLayerView).toHaveBeenCalledWith(deepCenter(rules.spacing));
    act(() => useUIStore.setState({ cameraTargetHex: deepCenter(rules.spacing) }));
    expect([...host.querySelectorAll('[role="tab"]')][1]!.textContent).toBe("Deep");
    open();
    expect(listRows().at(-1)?.[1]).toBe("true");
  });

  it("opens the Deep at the gate of the player's own Aspect", () => {
    const { store, realm } = researchedDay(3n);
    store.applyFacts([
      {
        model: "SettlementRules",
        key: "0x2",
        value: { ...store.require("SettlementRules", { game_id: 1 }), spacing: 1024 },
      },
      { model: "DeepRules", key: "0xdeef", value: DEEP_RULES },
      { model: "HomeAspect", key: "0xa59", value: { game_id: 1, home: realm.entity_id, aspect: 2 } },
    ] as never);
    const rules = readExpeditionRules(store, 1)!;
    context.mapView = true;
    useUIStore.setState({ cameraTargetHex: { col: 512, row: 512 } });
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    act(() => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][1]!.click());
    choose("Deep");
    expect(requestLayerView).toHaveBeenLastCalledWith({ col: 516, row: 3584 });
  });
});
