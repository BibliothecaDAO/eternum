import { CylinderGeometry, Group, Mesh } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralCharacterConfig } from "../procedural-character-config";
import type { ProceduralCharacterSocketReader } from "../procedural-character-sockets";
import { createDefaultProceduralMeleeConfig } from "./procedural-melee-config";
import type { ProceduralMeleeOffhandId } from "./procedural-melee-weapon-catalog";
import { ProceduralMeleeEquipment } from "./procedural-melee-equipment";
import type { ProceduralMeleeWeaponLibrary } from "./procedural-melee-weapon-library";

const SOCKETS: ProceduralCharacterSocketReader = {
  writeSocketWorldTransform: (_socketId, position) => {
    position.set(0, 0, 0);
    return true;
  },
};

function countShieldHandles(equipment: ProceduralMeleeEquipment): number {
  let handles = 0;
  equipment.group.traverse((object) => {
    const geometry = object instanceof Mesh ? object.geometry : undefined;
    if (geometry instanceof CylinderGeometry && geometry.parameters.radiusTop === 0.022) handles += 1;
  });
  return handles;
}

function buildOffhand(offhandId: ProceduralMeleeOffhandId, assetShield: boolean): ProceduralMeleeEquipment {
  const library = {
    instantiateWeapon: () => undefined,
    instantiateOffhand: () => (assetShield ? { object: new Group(), source: "asset" as const } : undefined),
    isWeaponReady: () => false,
    isOffhandReady: () => false,
  } as unknown as ProceduralMeleeWeaponLibrary;
  const equipment = new ProceduralMeleeEquipment(new Group(), SOCKETS, library);
  equipment.update(
    "knight",
    { ...createDefaultProceduralMeleeConfig("knight"), detailedEquipment: assetShield, offhandId },
    createDefaultProceduralCharacterConfig(),
  );
  return equipment;
}

describe("procedural melee shield handle", () => {
  it.each([true, false])("leaves a forearm-strapped shield without a handle (asset: %s)", (assetShield) => {
    expect(countShieldHandles(buildOffhand("t1-knight-bastion-shield", assetShield))).toBe(0);
  });

  it.each([true, false])("keeps one handle on a hand-held shield (asset: %s)", (assetShield) => {
    expect(countShieldHandles(buildOffhand("round-shield", assetShield))).toBe(1);
  });
});
