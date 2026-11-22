import { Scene } from "three";
import { describe, expect, it, vi } from "vitest";
import { configManager } from "@bibliothecadao/eternum";
import { deepZoneBounds } from "@bibliothecadao/eternum/game-client";
import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { DEEP_FLOOR } from "../terrain/deep-floor-material";
import { FLAT_TERRAIN_SURFACE } from "../terrain/terrain-surface";
import { DeepArenaManager } from "./deep-arena-manager";

vi.mock("@/hooks/store/use-account-store", () => ({ accountAddress: () => null }));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));
vi.mock("three", async (importOriginal) => {
  const three = await importOriginal<typeof import("three")>();
  return {
    ...three,
    TextureLoader: class {
      load = () => new three.Texture();
    },
  };
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
});
