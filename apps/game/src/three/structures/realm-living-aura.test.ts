import { InstancedMesh, BoxGeometry, Group, Matrix4, Mesh, MeshBasicMaterial } from "three";
import { afterEach, expect, it, vi } from "vitest";
import type NodeFrame from "three/src/nodes/core/NodeFrame.js";
import type { MeshBasicNodeMaterial } from "three/webgpu";
import { time } from "three/tsl";
import { mapAnimationTime, updateGameEndFreeze } from "../effects/game-end-freeze";
import { RealmLivingAura } from "./realm-living-aura";
import { createInstancedMesh } from "../utils/create-instanced-mesh";

afterEach(() => updateGameEndFreeze(0, false, 0));

it("freezes both aura shader outputs at game end and resumes in the same game, a new game and the lab", () => {
  const source = new Group();
  source.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
  const aura = new RealmLivingAura(source);
  const material = aura.mesh.material as MeshBasicNodeMaterial;
  for (const output of [material.positionNode, material.opacityNode]) {
    const clocks = new Set<unknown>();
    output!.traverse((node) => {
      if (node === time || node === mapAnimationTime) clocks.add(node);
    });
    expect([...clocks]).toEqual([mapAnimationTime]);
  }
  const frame = (seconds: number) => {
    mapAnimationTime.update({ time: seconds } as NodeFrame);
    return mapAnimationTime.value;
  };
  updateGameEndFreeze(13, false, 0.1);
  expect(frame(12)).toBe(12);
  updateGameEndFreeze(13, true, 0.1);
  expect(frame(20)).toBe(12);
  expect(frame(21)).toBe(12);
  updateGameEndFreeze(13, false, 0.1);
  expect(frame(22)).toBe(22);
  updateGameEndFreeze(13, true, 0.1);
  expect(frame(23)).toBe(22);
  updateGameEndFreeze(14, false, 0.1);
  expect(frame(24)).toBe(24);
  updateGameEndFreeze(14, true, 0.1);
  expect(frame(25)).toBe(24);
  updateGameEndFreeze(0, false, 0);
  expect(frame(26)).toBe(26);
  expect(frame(27)).toBe(27);
  aura.dispose();
});

it("keeps light above the entire crown and shares placement through removal and slot reuse", () => {
  const source = new Group();
  const crown = new Mesh(new BoxGeometry(1, 4, 1), new MeshBasicMaterial());
  crown.position.y = 2;
  source.add(crown);
  const placement = createInstancedMesh(crown.geometry, crown.material, 8);
  const aura = new RealmLivingAura(source, placement);
  const positions = aura.mesh.geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) expect(positions.getY(i)).toBeGreaterThanOrEqual(4.08);
  expect(aura.mesh.geometry.index!.count / 3).toBeLessThanOrEqual(100);
  const mesh = aura.mesh as InstancedMesh;
  expect(mesh.instanceMatrix).toBe(placement.instanceMatrix);
  placement.setMatrixAt(2, new Matrix4().makeTranslation(9, 2, 5));
  placement.count = 3;
  aura.setEntityAt(2, 1003);
  aura.syncCount();
  expect(mesh.count).toBe(3);
  const colors = aura.mesh.geometry.getAttribute("wonderTint");
  const teal = [colors.getX(2), colors.getY(2), colors.getZ(2)];
  aura.setEntityAt(2, 1004);
  expect([colors.getX(2), colors.getY(2), colors.getZ(2)]).not.toEqual(teal);
  placement.count = 0;
  aura.syncCount();
  expect(mesh.count).toBe(0);
  const dispose = vi.spyOn(aura.mesh.geometry, "dispose");
  aura.dispose();
  expect(dispose).toHaveBeenCalledOnce();
});
