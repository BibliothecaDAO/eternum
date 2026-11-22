import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { openPlace } from "@/play/navigation/open-place";
import { requestLayerView } from "@/three/scenes/worldmap-layer-request";
import {
  type ExpeditionRules,
  expeditionDayEndsAt,
  readExpeditionRules,
  setBlockTimestampSource,
} from "@bibliothecadao/eternum";
import { deepCenter, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { campBeside } from "../sites/site-fixture";

import { type MapLayers, useMapLayers } from "./map-layers";
import { SurfaceDeepSwitch } from "./surface-deep-switch";

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

const layersShowingII = (go: MapLayers["go"]): MapLayers => ({ layers: [0, 1, 2], shown: 2, go });

describe("the map's layers", () => {
  it("shows Surface beside the active depth and opens every unlocked layer in one list", () => {
    const go = vi.fn();
    const layers = layersShowingII(go);
    act(() => root.render(<SurfaceDeepSwitch layers={layers} />));
    const buttons = [...host.querySelectorAll<HTMLButtonElement>("[data-surface-deep-switch] button")];
    expect(buttons.map((button) => [button.textContent, button.getAttribute("aria-pressed")])).toEqual([
      ["Surface", "false"],
      ["Hollow", "true"],
    ]);
    expect(buttons[1]!.querySelector("img")?.getAttribute("src")).toContain("depth-2");

    act(() => buttons[1]!.click());
    expect(openList()).toEqual([
      ["Surface", "false"],
      ["Veil", "false"],
      ["Hollow", "true"],
    ]);
    choose("Veil");
    expect(go).toHaveBeenCalledWith(1);
    expect(openList()).toEqual([]);

    act(() => buttons[1]!.click());
    choose("Hollow");
    expect(go).toHaveBeenCalledTimes(1);

    act(() => buttons[0]!.click());
    expect(go).toHaveBeenLastCalledWith(0);
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
  clockAt(store, now);
  return { store, realm, rules };
};

const clockAt = (store: NativeFactStore, seconds: number) =>
  act(() => {
    useChainTimeStore.getState().anchor({ timestamp: seconds * 1_000 });
    setBlockTimestampSource(() => seconds);
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: seconds });
  });

const LayerSwitch = ({ rules, realm }: { rules: ExpeditionRules; realm: NativeRows["Structure"] }) => {
  const layers = useMapLayers(rules, realm, realm);
  return <SurfaceDeepSwitch layers={layers} />;
};

const listRows = () =>
  [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((item) => [
    item.textContent,
    item.getAttribute("aria-checked"),
  ]);

describe("the layer switch over the real layers", () => {
  it("stays absent before Veil and while on the realm board", () => {
    const { rules, realm } = researchedDay(0n);
    context.mapView = true;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    expect(host.querySelector("[data-surface-deep-switch]")).toBeNull();

    const unlocked = researchedDay(3n);
    context.mapView = false;
    act(() => root.render(<LayerSwitch rules={unlocked.rules} realm={unlocked.realm} />));
    expect(host.querySelector("[data-surface-deep-switch]")).toBeNull();
    expect(openPlace).not.toHaveBeenCalled();
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
    const open = () =>
      act(() => [...host.querySelectorAll<HTMLButtonElement>("[data-surface-deep-switch] button")][1]!.click());
    open();
    expect(listRows().map(([label]) => label)).toEqual(["Surface", "Veil", "Hollow", "Deep"]);
    choose("Deep");
    expect(requestLayerView).toHaveBeenCalledTimes(1);
    expect(requestLayerView).toHaveBeenCalledWith(deepCenter(rules.spacing));
    act(() => useUIStore.setState({ cameraTargetHex: deepCenter(rules.spacing) }));
    expect([...host.querySelectorAll("[data-surface-deep-switch] button")][1]!.textContent).toBe("Deep");
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
    act(() => [...host.querySelectorAll<HTMLButtonElement>("[data-surface-deep-switch] button")][1]!.click());
    choose("Deep");
    expect(requestLayerView).toHaveBeenLastCalledWith({ col: 516, row: 3584 });
  });
});
