import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { requestLayerView } from "@/three/scenes/worldmap-layer-request";
import {
  type ExpeditionRules,
  expeditionDayEndsAt,
  readExpeditionRules,
  setBlockTimestampSource,
  structureMapPosition,
  viewInLayer,
} from "@bibliothecadao/eternum";
import { deepCenter, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { campBeside } from "../sites/site-fixture";

import { selectLayer, type MapLayers, useMapLayers } from "./map-layers";
import { PlaceMenu } from "./surface-deep-switch";

const context = vi.hoisted(() => ({
  store: null as NativeFactStore | null,
  mapView: true,
}));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: context.store } }) }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: context.mapView }) }));
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

const placeRows = () => {
  if (!document.querySelector("[data-surface-deep-switch]"))
    act(() => host.querySelector<HTMLButtonElement>("[data-place-pill]")!.click());
  return [...document.querySelectorAll<HTMLButtonElement>('[data-surface-deep-switch] [role="tab"]')];
};

const tabNamed = (word: string) => placeRows().find((tab) => tab.getAttribute("aria-label") === word)!;

const pressTab = (word: string) => {
  const tab = tabNamed(word);
  act(() => tab.click());
};

const layersShowingII = (go: MapLayers["go"]): MapLayers => ({ layers: [0, 1, 2], shown: 2, go });

describe("the map's layers", () => {
  it("lists all five places with locked Deep disabled and switches directly between unlocked layers", () => {
    const go = vi.fn();
    const layers = layersShowingII(go);
    act(() =>
      root.render(
        <PlaceMenu isMapView layers={layers} onGoRealm={() => {}} onGoSurface={() => selectLayer(layers, 0)} />,
      ),
    );
    expect(
      placeRows().map((row) => [row.getAttribute("aria-label"), row.getAttribute("aria-selected"), row.disabled]),
    ).toEqual([
      ["Realm", "false", false],
      ["Surface", "false", false],
      ["Veil", "false", false],
      ["Hollow", "true", false],
      ["Deep", "false", true],
    ]);
    expect(tabNamed("Hollow").querySelector("img")?.getAttribute("src")).toContain("depth-2");

    pressTab("Veil");
    expect(go).toHaveBeenCalledWith(1);

    pressTab("Hollow");
    expect(go).toHaveBeenCalledTimes(1);

    pressTab("Surface");
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
  return (
    <PlaceMenu
      isMapView={context.mapView}
      layers={layers}
      onGoRealm={() => {}}
      onGoSurface={() => layers && selectLayer(layers, 0)}
    />
  );
};

describe("the layer switch over the real layers", () => {
  it("locks all depths before Veil and selects Realm on the realm board", () => {
    const { rules, realm } = researchedDay(0n);
    context.mapView = true;
    act(() => root.render(<LayerSwitch rules={rules} realm={realm} />));
    expect(
      placeRows()
        .filter((row) => row.dataset.depth !== undefined)
        .every((row) => row.disabled),
    ).toBe(true);
    act(() => host.querySelector<HTMLButtonElement>("[data-place-pill]")!.click());

    const unlocked = researchedDay(3n);
    context.mapView = false;
    act(() => root.render(<LayerSwitch rules={unlocked.rules} realm={unlocked.realm} />));
    expect(tabNamed("Realm").getAttribute("aria-selected")).toBe("true");
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
    expect(
      placeRows()
        .filter((row) => row.dataset.depth !== undefined)
        .map((row) => row.getAttribute("aria-label")),
    ).toEqual(["Veil", "Hollow", "Deep"]);
    pressTab("Deep");
    expect(requestLayerView).toHaveBeenCalledTimes(1);
    expect(requestLayerView).toHaveBeenCalledWith(deepCenter(rules.spacing));
    act(() => useUIStore.setState({ cameraTargetHex: deepCenter(rules.spacing) }));
    expect(tabNamed("Deep").getAttribute("aria-selected")).toBe("true");
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
    pressTab("Deep");
    expect(requestLayerView).toHaveBeenLastCalledWith({ col: 516, row: 3584 });
  });

  it("recognizes a Deep camera tile even when the watched realm has not reached depth 3 and returns to the realm site on Surface", () => {
    const { store, realm } = researchedDay(1n);
    store.applyFacts([
      {
        model: "SettlementRules",
        key: "0x2",
        value: { ...store.require("SettlementRules", { game_id: 1 }), spacing: 1024 },
      },
      { model: "DeepRules", key: "0xdeef", value: DEEP_RULES },
    ] as never);
    const rules = readExpeditionRules(store, 1)!;
    const site = structureMapPosition(store, realm)!;
    expect(site.x).not.toBe(deepCenter(rules.spacing).col);
    context.mapView = true;
    useUIStore.setState({ cameraTargetHex: deepCenter(rules.spacing) });
    const seen: { current: MapLayers | null } = { current: null };
    const Probe = () => {
      seen.current = useMapLayers(rules, realm, realm);
      return null;
    };
    act(() => root.render(<Probe />));
    expect(seen.current?.shown).toBe("deep");
    expect(seen.current?.layers).toEqual([0]);
    act(() => seen.current!.go(0));
    expect(requestLayerView).toHaveBeenCalledTimes(1);
    expect(requestLayerView).toHaveBeenCalledWith(viewInLayer(rules, { col: site.x, row: site.y }, 0));
  });
});
