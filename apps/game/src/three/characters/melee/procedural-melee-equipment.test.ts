import { CylinderGeometry, Group, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralCharacterConfig } from "../procedural-character-config";
import type { ProceduralCharacterSocketReader } from "../procedural-character-sockets";
import { createDefaultProceduralMeleeConfig } from "./procedural-melee-config";
import type { ProceduralMeleeOffhandId } from "./procedural-melee-weapon-catalog";
import { ProceduralMeleeEquipment, resolveProceduralMeleeWeaponDirection } from "./procedural-melee-equipment";
import { resolveProceduralMeleeUpperBodyPose } from "./procedural-melee-pose";
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
    expect(countShieldHandles(buildOffhand("t1-knight-default-shield", assetShield))).toBe(0);
  });

  it.each([true, false])("keeps one handle on a hand-held shield (asset: %s)", (assetShield) => {
    expect(countShieldHandles(buildOffhand("round-shield", assetShield))).toBe(1);
  });
});

describe("procedural melee socket placement", () => {
  it("throws when fitted gear needs a forearm socket the rig lacks, instead of leaving it loose", () => {
    const sockets: ProceduralCharacterSocketReader = {
      writeSocketWorldTransform: (socketId, position) => {
        position.set(0, 0, 0);
        return socketId !== "forearmLeft";
      },
    };
    const library = {
      instantiateWeapon: () => undefined,
      instantiateOffhand: () => undefined,
      isWeaponReady: () => false,
      isOffhandReady: () => false,
    } as unknown as ProceduralMeleeWeaponLibrary;
    const equipment = new ProceduralMeleeEquipment(new Group(), sockets, library);
    const config = { ...createDefaultProceduralMeleeConfig("knight"), offhandId: "t1-knight-default-shield" as const };

    expect(() => equipment.update("knight", config, createDefaultProceduralCharacterConfig())).toThrow("forearmLeft");
  });
});

describe("intended weapon direction", () => {
  const resolveAt = (phase: "idle" | "windup" | "contact", phaseElapsedSeconds: number) =>
    resolveProceduralMeleeWeaponDirection(
      resolveProceduralMeleeUpperBodyPose({
        aimPitchRadians: 0,
        aimYawRadians: 0,
        attackStyle: "slash",
        config: createDefaultProceduralMeleeConfig(),
        mounted: false,
        moving: false,
        state: { attackGeneration: 1, contactCount: 0, phase, phaseElapsedSeconds },
      }),
      new Vector3(),
    );

  it("carries the blade down and forward, raises it for the windup and brings it forward for the blow", () => {
    const carry = resolveProceduralMeleeWeaponDirection(undefined, new Vector3());
    const windup = resolveAt("windup", createDefaultProceduralMeleeConfig().windupSeconds);
    const contact = resolveAt("contact", createDefaultProceduralMeleeConfig().contactSeconds);

    expect(carry.y).toBeLessThan(-0.9);
    expect(carry.length()).toBeCloseTo(1, 6);
    expect(windup.y).toBeGreaterThan(0.4);
    expect(contact.z).toBeGreaterThan(0.5);
  });
});
