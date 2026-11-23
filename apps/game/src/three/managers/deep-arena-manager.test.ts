import { Color, BoxGeometry, InstancedMesh, Mesh, MeshBasicMaterial, Scene } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "@bibliothecadao/eternum";
import { deepGateTiles, deepZoneBounds } from "@bibliothecadao/eternum/game-client";
import { ASPECT_HEX, SIDE_HEX } from "@/tokens";
import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { DEEP_GATE_MODELS } from "../structures/deep-landmarks";
import { DEEP_FLOOR } from "../terrain/deep-floor-material";
import { FLAT_TERRAIN_SURFACE } from "../terrain/terrain-surface";
import { DeepArenaManager } from "./deep-arena-manager";

const { loadGate, viewer } = vi.hoisted(() => ({
  loadGate: vi.fn(async (path: string) => ({
    path,
    scene: new Mesh(new BoxGeometry(1, 1.4, 1), new MeshBasicMaterial()),
  })),
  viewer: { address: null as bigint | null },
}));

vi.mock("@/hooks/store/use-account-store", () => ({ accountAddress: () => viewer.address }));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));
vi.mock("../utils/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/utils")>()),
  gltfLoader: { loadAsync: loadGate },
}));

beforeEach(() => {
  viewer.address = null;
  loadGate.mockClear();
});

describe("the Deep arena", () => {
  it("draws its floor's zones from the one bounds table the props and cards read", () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    const { gateDistance, rings } = frontierSeasonOnePreset.deep;
    const rules = { game_id: 1, gate_distance: gateDistance, rings };
    const rows: Record<string, unknown> = { DeepRules: rules, SettlementRules: { game_id: 1, spacing: 1024 } };
    const store = { get: (model: string) => rows[model], subscribe: () => () => {} };
    const manager = new DeepArenaManager(new Scene(), store as never, FLAT_TERRAIN_SURFACE);
    const bounds = deepZoneBounds(rules);
    const drawn = [
      DEEP_FLOOR.ringRadii.value.x,
      DEEP_FLOOR.ringRadii.value.y,
      DEEP_FLOOR.ringRadii.value.z,
      DEEP_FLOOR.ringRadii.value.w,
    ];
    expect({
      plazaBelow: DEEP_FLOOR.plazaBelow.value,
      ringRadii: drawn,
      rimBeyond: DEEP_FLOOR.rimBeyond.value,
    }).toEqual(bounds);
    expect(bounds).toEqual({ plazaBelow: 5, ringRadii: [7, 11, 15, 19], rimBeyond: 20 });
    expect(loadGate.mock.calls.map(([path]) => path).toSorted()).toEqual(Object.values(DEEP_GATE_MODELS).toSorted());
    manager.destroy();
  });

  it("fades its floor into the mist only short of the gates, so a gate on the square's edge stands on solid ground", () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    const fadeWith = (gateDistance: number) => {
      const rows: Record<string, unknown> = {
        DeepRules: { game_id: 1, gate_distance: gateDistance, rings: frontierSeasonOnePreset.deep.rings },
        SettlementRules: { game_id: 1, spacing: 1024 },
      };
      const store = { get: (model: string) => rows[model], subscribe: () => () => {} };
      const manager = new DeepArenaManager(new Scene(), store as never, FLAT_TERRAIN_SURFACE);
      const fade = DEEP_FLOOR.edgeFade.value;
      manager.destroy();
      return fade;
    };
    expect(fadeWith(4)).toBe(8);
    expect(fadeWith(24)).toBe(0);
  });

  it("colours the viewer's own gate green and every other Aspect gate from the Aspect palette", () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    viewer.address = 42n;
    const rules = {
      game_id: 1,
      gate_distance: frontierSeasonOnePreset.deep.gateDistance,
      rings: frontierSeasonOnePreset.deep.rings,
    };
    let ownAspect: number | undefined = 2;
    let onStoreChange: ((changes: { model: string }[]) => void) | undefined;
    const store = {
      get: (model: string, key?: { home?: number }) => {
        if (model === "DeepRules") return rules;
        if (model === "SettlementRules") return { game_id: 1, spacing: 1024 };
        if (model === "HomeAspect" && key?.home === 101 && ownAspect !== undefined) return { aspect: ownAspect };
        return undefined;
      },
      structuresOwnedBy: (_gameId: number, owner: bigint) => (owner === 42n ? [{ entity_id: 101 }] : []),
      subscribe: (listener: (changes: { model: string }[]) => void) => {
        onStoreChange = listener;
        return () => {};
      },
    };
    const scene = new Scene();
    const manager = new DeepArenaManager(scene, store as never, FLAT_TERRAIN_SURFACE);
    const arena = scene.getObjectByName("deep-arena")!;
    const veil = arena.children.find(
      (child): child is InstancedMesh => child instanceof InstancedMesh && child.renderOrder === 2,
    )!;
    const gates = deepGateTiles(rules.gate_distance, 1024);
    const actual = new Color();
    gates.forEach((gate, index) => {
      veil.getColorAt(index, actual);
      expect(actual.getHex()).toBe(new Color(gate.aspect === 2 ? SIDE_HEX.own : ASPECT_HEX[gate.aspect]).getHex());
    });
    ownAspect = 4;
    onStoreChange?.([{ model: "HomeAspect" }]);
    gates.forEach((gate, index) => {
      veil.getColorAt(index, actual);
      expect(actual.getHex()).toBe(new Color(gate.aspect === 4 ? SIDE_HEX.own : ASPECT_HEX[gate.aspect]).getHex());
    });
    manager.destroy();
  });
});
