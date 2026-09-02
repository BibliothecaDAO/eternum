import { type HexPosition, type ID } from "@bibliothecadao/types";
import { Color } from "three";

import { getWorldPositionForHex } from "../utils";
import { resolveOwnershipPulseHexes } from "./worldmap-ownership-pulse-policy";

export interface StructureOwnershipPulseColors {
  base: Color;
  pulse: Color;
}

export interface WorldmapOwnershipPulsePresenterDeps {
  clearOwnershipPulses: () => void;
  showOwnershipPulses: (positions: Array<{ x: number; z: number }>, baseColor: Color, pulseColor: Color) => void;
  getStructureHex: (structureId: ID) => HexPosition | undefined;
  getOwnedArmyHexes: (structureId: ID) => Array<HexPosition | null | undefined>;
}

/**
 * Presents the selection-feedback overlay that pulses a structure's owned footprint
 * (its own hex plus every owned army). Its only state is a per-structure colour cache
 * keyed by id; the footprint geometry is resolved by {@link resolveOwnershipPulseHexes}.
 */
export class WorldmapOwnershipPulsePresenter {
  private readonly colorCache = new Map<string, StructureOwnershipPulseColors>();

  constructor(private readonly deps: WorldmapOwnershipPulsePresenterDeps) {}

  update(structureId: ID | undefined, extraHexes: HexPosition[] = [], suppressedHexes: HexPosition[] = []): void {
    if (structureId === undefined || structureId === null) {
      this.deps.clearOwnershipPulses();
      return;
    }

    const colors = this.resolveColors(structureId);
    const ownershipHexes = resolveOwnershipPulseHexes({
      structureHex: this.deps.getStructureHex(structureId),
      ownedArmyHexes: this.deps.getOwnedArmyHexes(structureId),
      extraHexes,
      suppressedHexes,
    });

    const positions = ownershipHexes.map((hex) => {
      const worldPos = getWorldPositionForHex(hex);
      return { x: worldPos.x, z: worldPos.z };
    });

    if (positions.length === 0) {
      this.deps.clearOwnershipPulses();
      return;
    }

    this.deps.showOwnershipPulses(positions, colors.base, colors.pulse);
  }

  private resolveColors(structureId: ID): StructureOwnershipPulseColors {
    const key = structureId.toString();
    const cached = this.colorCache.get(key);
    if (cached) {
      return cached;
    }

    const numericId = Number(structureId);
    const hue = (((numericId % 360) + 360) % 360) / 360;
    const base = new Color().setHSL(hue, 0.65, 0.4);
    const pulse = new Color().setHSL(hue, 0.65, 0.6);
    const colors = { base, pulse };
    this.colorCache.set(key, colors);
    return colors;
  }
}
