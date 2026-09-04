import { Group, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import type { CharacterSocketId, ProceduralCharacterSocketReader } from "./procedural-character-sockets";
import { createDefaultProceduralMeleeConfig } from "./melee/procedural-melee-config";
import { ProceduralMeleeWeaponLibrary } from "./melee/procedural-melee-weapon-library";
import { ProceduralUnitEquipment } from "./procedural-unit-equipment";

describe("procedural unit equipment grips", () => {
  it("solves both crossbow handles onto their anatomical grip sockets", async () => {
    const root = new Group();
    const sockets = createGripSockets({ left: new Vector3(0.24, 1.1, 0.3), right: new Vector3(-0.24, 1.1, 0.3) });
    const library = await ProceduralMeleeWeaponLibrary.create();
    const equipment = new ProceduralUnitEquipment(
      root,
      sockets,
      "crossbowman",
      createDefaultProceduralCharacterConfig(),
      createDefaultProceduralMeleeConfig(),
      library,
    );

    equipment.update("crossbowman", createDefaultProceduralCharacterConfig(), createDefaultProceduralMeleeConfig());
    const diagnostics = equipment.getCrossbowPoseDiagnostics();

    expect(
      new Vector3().fromArray(diagnostics?.leftGripWorld ?? []).distanceTo(new Vector3(0.24, 1.1, 0.3)),
    ).toBeLessThan(0.0001);
    expect(
      new Vector3().fromArray(diagnostics?.rightGripWorld ?? []).distanceTo(new Vector3(-0.24, 1.1, 0.3)),
    ).toBeLessThan(0.0001);
    equipment.dispose();
  });

  it("places melee weapon and shield roots at their distinct hand grips", async () => {
    const root = new Group();
    const leftGrip = new Vector3(0.5, 1.2, 0.4);
    const rightGrip = new Vector3(-0.3, 1.1, 0.2);
    const library = await ProceduralMeleeWeaponLibrary.create();
    const equipment = new ProceduralUnitEquipment(
      root,
      createGripSockets({ left: leftGrip, right: rightGrip }),
      "knight",
      createDefaultProceduralCharacterConfig(),
      createDefaultProceduralMeleeConfig(),
      library,
    );
    const diagnostics = equipment.getMeleePoseDiagnostics();

    expect(new Vector3().fromArray(diagnostics?.weaponGripWorld ?? []).distanceTo(rightGrip)).toBeLessThan(0.0001);
    expect(new Vector3().fromArray(diagnostics?.offhandGripWorld ?? []).distanceTo(leftGrip)).toBeLessThan(0.0001);
    expect(new Vector3().fromArray(diagnostics?.offhandWorld ?? []).distanceTo(leftGrip)).toBeGreaterThan(0.15);
    equipment.dispose();
  });
});

function createGripSockets(grips: { left: Vector3; right: Vector3 }): ProceduralCharacterSocketReader {
  return {
    writeSocketWorldTransform(socketId: CharacterSocketId, outPosition: Vector3, outQuaternion: Quaternion): boolean {
      if (socketId === "gripLeft") outPosition.copy(grips.left);
      else if (socketId === "gripRight") outPosition.copy(grips.right);
      else return false;
      outQuaternion.identity();
      return true;
    },
  };
}
