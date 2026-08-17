import { Direction } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { resolveCreateArmyEffectTargetHex } from "./worldmap-pending-action-effect-policy";

describe("resolveCreateArmyEffectTargetHex", () => {
  it("resolves the adjacent hex for a valid direction", () => {
    const target = resolveCreateArmyEffectTargetHex({ col: 10, row: 10 }, Direction.EAST);
    expect(target).toEqual({ col: 11, row: 10 });
  });

  it("returns null when structure hex is missing", () => {
    const target = resolveCreateArmyEffectTargetHex(undefined, Direction.NORTH_EAST);
    expect(target).toBeNull();
  });
});
