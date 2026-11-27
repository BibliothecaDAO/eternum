// @vitest-environment node
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Group, Mesh, MeshStandardMaterial, Texture, Vector3, type Material } from "three";
import { describe, expect, it, vi } from "vitest";
import { mapAnimationTime } from "../../effects/endgame/state";
import { isProcgenMasonryMaterial } from "../../structures/procgen-masonry-material";
import { isProceduralModelPath, resolveProceduralModel } from "../../structures/procedural-model-resolver";
import { TERRAIN_HEX_HORIZONTAL_SPACING } from "../../terrain/terrain-coordinates";
import {
  SHIP_WORLD_SCALE,
  bakeShipWorldScale,
  createShipDesign,
  type ShipArmyClass,
  type ShipTier,
} from "./ship-design";
import {
  createProceduralShipTemplate,
  isProceduralShipPath,
  parseProceduralShipPath,
  proceduralShipPath,
  resolveProceduralShipKit,
} from "./ship-kit";
import { SHIP_CLOTH_PARAMS, createOwnershipPennantMaterial, createOwnershipSailMaterial } from "./ship-sail-material";

const classes: ShipArmyClass[] = ["knight", "crossbowman", "paladin"];
const tiers: ShipTier[] = [1, 2, 3];

interface VertexInput {
  readonly position: readonly [number, number, number];
  readonly uv: readonly [number, number];
  readonly mastClearanceZ: number;
}

type EvalResult = number | readonly number[];

function asNumber(value: EvalResult): number {
  if (typeof value !== "number") throw new Error(`Expected scalar TSL value, got vector of length ${value.length}`);
  return value;
}

function evalTslNode(node: unknown, vertex: VertexInput): EvalResult {
  if (!node || typeof node !== "object") throw new Error("Missing TSL node");
  const n = node as Record<string, unknown>;
  if (n.isVarNode) return evalTslNode(n.node, vertex);
  if (n.isConstNode || n.isUniformNode) return asNumber(n.value as number);
  if (typeof n._attributeName === "string") {
    if (n._attributeName === "position") return vertex.position;
    if (n._attributeName === "uv") return vertex.uv;
    if (n._attributeName === "aMastClearanceZ") return vertex.mastClearanceZ;
    throw new Error(`Unsupported TSL attribute: ${n._attributeName}`);
  }
  if (n.isSplitNode) {
    const vec = evalTslNode(n.node, vertex);
    if (!Array.isArray(vec)) throw new Error("Expected vector for SplitNode");
    const index = n.components === "x" ? 0 : n.components === "y" ? 1 : n.components === "z" ? 2 : -1;
    if (index < 0) throw new Error(`Unsupported SplitNode components: ${String(n.components)}`);
    return vec[index];
  }
  if (Array.isArray(n.nodes)) {
    return n.nodes.map((child) => asNumber(evalTslNode(child, vertex)));
  }
  if (n.isOperatorNode) {
    const a = asNumber(evalTslNode(n.aNode, vertex));
    const b = asNumber(evalTslNode(n.bNode, vertex));
    if (n.op === "+") return a + b;
    if (n.op === "-") return a - b;
    if (n.op === "*") return a * b;
    if (n.op === "/") return a / b;
    throw new Error(`Unsupported TSL operator: ${String(n.op)}`);
  }
  if (n.isMathNode) {
    const a = asNumber(evalTslNode(n.aNode, vertex));
    if (n.method === "sin") return Math.sin(a);
    if (n.method === "cos") return Math.cos(a);
    if (n.method === "abs") return Math.abs(a);
    if (n.method === "negate") return -a;
    const b = asNumber(evalTslNode(n.bNode, vertex));
    if (n.method === "min") return Math.min(a, b);
    if (n.method === "max") return Math.max(a, b);
    const c = asNumber(evalTslNode(n.cNode, vertex));
    if (n.method === "mix") return a + (b - a) * c;
    throw new Error(`Unsupported TSL math method: ${String(n.method)}`);
  }
  throw new Error(`Unsupported TSL node: ${String(n.constructor?.name ?? "unknown")}`);
}

function evaluatePositionNode(positionNode: unknown, vertex: VertexInput, out: Vector3): Vector3 {
  const result = evalTslNode(positionNode, vertex);
  if (!Array.isArray(result) || result.length !== 3) {
    throw new Error("Expected vec3 result from positionNode");
  }
  return out.set(result[0], result[1], result[2]);
}

function disposeTemplate(template: Group): void {
  template.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) material.dispose();
  });
}

function findBoundPrintTexture(colorNode: unknown): Texture | null {
  const visited = new Set<unknown>();
  const stack: unknown[] = [colorNode];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    if ("isTextureNode" in current && "value" in current) {
      return (current as { value: Texture | null }).value;
    }
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    for (const value of Object.values(current as Record<string, unknown>)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }
  return null;
}

describe("Procedural naval fleet kit", () => {
  it("resolves all 9 class and tier procedural ship paths and rejects invalid ones", () => {
    for (const army of classes) {
      for (const tier of tiers) {
        const path = proceduralShipPath(army, tier);
        expect(isProceduralShipPath(path)).toBe(true);
        expect(isProceduralModelPath(path)).toBe(true);
        expect(parseProceduralShipPath(path)).toEqual({ army, tier });
        const gltf = resolveProceduralModel(path);
        expect(gltf).not.toBeNull();
        expect(gltf!.scene.name).toBe(`ship-${army}-t${tier}`);
        disposeTemplate(gltf!.scene);
      }
    }
    expect(isProceduralShipPath("ships/knight-t1.glb")).toBe(false);
    expect(isProceduralShipPath("procedural:ship:dragon:t1")).toBe(false);
    expect(resolveProceduralShipKit("units/default_knight_lvl1.glb")).toBeNull();
  });

  it("builds 3 draws per ship with distinct tier progression and zero hull textures", () => {
    const classSignatures = new Set<string>();
    for (const army of classes) {
      const tierTriangles: number[] = [];
      for (const tier of tiers) {
        const template = createProceduralShipTemplate(army, tier);
        const meshes: Mesh[] = [];
        template.traverse((node) => {
          if (node instanceof Mesh) meshes.push(node);
        });
        expect(meshes).toHaveLength(3);

        const hull = template.getObjectByName("FleetHull") as Mesh;
        const sail = template.getObjectByName("Sail_0") as Mesh;
        const pennant = template.getObjectByName("Pennant_0") as Mesh;
        expect(hull).toBeInstanceOf(Mesh);
        expect(sail).toBeInstanceOf(Mesh);
        expect(pennant).toBeInstanceOf(Mesh);

        expect(isProcgenMasonryMaterial(hull.material as Material)).toBe(true);
        expect(hull.geometry.getAttribute("normal")).toBeDefined();
        expect(hull.geometry.getAttribute("color")).toBeDefined();
        expect((hull.material as Material & { map?: unknown }).map ?? null).toBeNull();

        expect(sail.geometry.getAttribute("uv")).toBeDefined();
        expect(sail.geometry.getAttribute("aMastClearanceZ")).toBeDefined();
        expect(sail.userData.sailCount).toBe(tier === 1 ? 1 : 2);
        expect(pennant.geometry.getAttribute("uv")).toBeDefined();

        const design = createShipDesign(template, army, tier);
        tierTriangles.push(design.triangles);
        expect(design.triangles).toBeGreaterThan(1000);
        expect(design.triangles).toBeLessThan(15000);
        if (tier === 3) classSignatures.add(`${army}:${design.triangles}`);
        design.dispose();
        disposeTemplate(template);
      }
      expect(tierTriangles[0]).toBeLessThan(tierTriangles[1]);
      expect(tierTriangles[1]).toBeLessThan(tierTriangles[2]);
    }
    expect(classSignatures.size).toBe(3);
  });

  it("keeps every procedural ship and its live GPU cloth shader vertices inside one hex throughout sailing", () => {
    const point = new Vector3();
    const apothem = TERRAIN_HEX_HORIZONTAL_SPACING / 2;
    const lengths = new Set<number>();
    const scales = new Set<number>();

    for (const army of classes) {
      for (const tier of tiers) {
        const template = createProceduralShipTemplate(army, tier);
        const design = createShipDesign(template, army, tier);
        lengths.add(design.length);
        scales.add(design.object.scale.x);
        design.setWind(2);
        let radius = 0;
        let finite = true;
        for (const seconds of [0, 0.5, 1, 2, 3, 4, 5, 6]) {
          design.animate(seconds, true);
          design.object.rotation.y = seconds;
          design.object.updateMatrixWorld(true);
          design.object.traverseVisible((object) => {
            if (!(object instanceof Mesh)) return;
            const positions = object.geometry.attributes.position;
            const uv = object.geometry.attributes.uv;
            const clearance = object.geometry.attributes.aMastClearanceZ;
            const positionNode = (object.material as Material & { positionNode?: unknown }).positionNode ?? null;
            for (let i = 0; i < positions.count; i++) {
              if (positionNode) {
                evaluatePositionNode(
                  positionNode,
                  {
                    position: [positions.getX(i), positions.getY(i), positions.getZ(i)],
                    uv: [uv.getX(i), uv.getY(i)],
                    mastClearanceZ: clearance ? clearance.getX(i) : 0,
                  },
                  point,
                );
              } else {
                point.fromBufferAttribute(positions, i);
              }
              point.applyMatrix4(object.matrixWorld);
              finite &&= Number.isFinite(point.lengthSq());
              radius = Math.max(radius, Math.hypot(point.x, point.z));
            }
          });
        }
        expect(finite).toBe(true);
        expect(radius).toBeLessThan(apothem);
        design.dispose();
        disposeTemplate(template);
      }
    }
    expect([...lengths]).toEqual([4.2 * SHIP_WORLD_SCALE]);
    expect([...scales]).toEqual([SHIP_WORLD_SCALE]);
  });

  it("evaluates live GPU TSL cloth shaders for billowing, edge pinning, loop continuity, and zero CPU mutation", () => {
    const out = new Vector3();
    for (const army of classes) {
      for (const tier of tiers) {
        const template = createProceduralShipTemplate(army, tier);
        const design = createShipDesign(template, army, tier);
        const sail = design.object.getObjectByName("Sail_0") as Mesh;
        const pennant = design.object.getObjectByName("Pennant_0") as Mesh;
        const sailNode = (sail.material as Material & { positionNode: unknown }).positionNode;
        const pennantNode = (pennant.material as Material & { positionNode: unknown }).positionNode;
        expect(sailNode).not.toBeNull();
        expect(pennantNode).not.toBeNull();

        const sailPos = sail.geometry.attributes.position;
        const sailUv = sail.geometry.attributes.uv;
        const sailClearance = sail.geometry.attributes.aMastClearanceZ;
        const pennantPos = pennant.geometry.attributes.position;
        const pennantUv = pennant.geometry.attributes.uv;
        const restPos = Array.from(sailPos.array);
        const restUv = Array.from(sailUv.array);

        design.setWind(0);
        design.animate(2, true);
        for (let i = 0; i < sailPos.count; i++) {
          evaluatePositionNode(
            sailNode,
            {
              position: [sailPos.getX(i), sailPos.getY(i), sailPos.getZ(i)],
              uv: [sailUv.getX(i), sailUv.getY(i)],
              mastClearanceZ: sailClearance.getX(i),
            },
            out,
          );
          expect(Math.abs(out.z - sailPos.getZ(i))).toBeLessThan(1e-7);
        }

        design.setWind(1.8);
        design.animate(1.5, true);
        expect(Array.from(sailPos.array)).toEqual(restPos);
        expect(Array.from(sailUv.array)).toEqual(restUv);

        let maxSailDisp = 0;
        let maxFootDisp = 0;
        for (let i = 0; i < sailPos.count; i++) {
          const u = sailUv.getX(i);
          const v = sailUv.getY(i);
          evaluatePositionNode(
            sailNode,
            {
              position: [sailPos.getX(i), sailPos.getY(i), sailPos.getZ(i)],
              uv: [u, v],
              mastClearanceZ: sailClearance.getX(i),
            },
            out,
          );
          const delta = Math.abs(out.z - sailPos.getZ(i));
          maxSailDisp = Math.max(maxSailDisp, delta);
          if (v < 1e-5 || Math.abs(u * 2 - 1) > 0.99999) {
            expect(out.z).toBeCloseTo(sailPos.getZ(i), 5);
          }
          if (v > 0.99999) {
            maxFootDisp = Math.max(maxFootDisp, delta);
          }
        }
        expect(maxSailDisp).toBeGreaterThan(0.08);
        expect(maxFootDisp).toBeGreaterThan(0.01);

        design.animate(0, true);
        const sailStart = Array.from(
          { length: sailPos.count },
          (_, i) =>
            evaluatePositionNode(
              sailNode,
              {
                position: [sailPos.getX(i), sailPos.getY(i), sailPos.getZ(i)],
                uv: [sailUv.getX(i), sailUv.getY(i)],
                mastClearanceZ: sailClearance.getX(i),
              },
              out,
            ).z,
        );
        const pennantStart = Array.from(
          { length: pennantPos.count },
          (_, i) =>
            evaluatePositionNode(
              pennantNode,
              {
                position: [pennantPos.getX(i), pennantPos.getY(i), pennantPos.getZ(i)],
                uv: [pennantUv.getX(i), pennantUv.getY(i)],
                mastClearanceZ: 0,
              },
              out,
            ).z,
        );
        const startY = design.object.children[0].position.y;
        const startRotZ = design.object.children[0].rotation.z;
        const startRotX = design.object.children[0].rotation.x;

        design.animate(SHIP_CLOTH_PARAMS.cycleSeconds, true);
        for (let i = 0; i < sailPos.count; i++) {
          const endZ = evaluatePositionNode(
            sailNode,
            {
              position: [sailPos.getX(i), sailPos.getY(i), sailPos.getZ(i)],
              uv: [sailUv.getX(i), sailUv.getY(i)],
              mastClearanceZ: sailClearance.getX(i),
            },
            out,
          ).z;
          expect(endZ).toBeCloseTo(sailStart[i], 5);
        }
        for (let i = 0; i < pennantPos.count; i++) {
          const endZ = evaluatePositionNode(
            pennantNode,
            {
              position: [pennantPos.getX(i), pennantPos.getY(i), pennantPos.getZ(i)],
              uv: [pennantUv.getX(i), pennantUv.getY(i)],
              mastClearanceZ: 0,
            },
            out,
          ).z;
          expect(endZ).toBeCloseTo(pennantStart[i], 5);
        }
        expect(design.object.children[0].position.y).toBeCloseTo(startY, 6);
        expect(design.object.children[0].rotation.z).toBeCloseTo(startRotZ, 6);
        expect(design.object.children[0].rotation.x).toBeCloseTo(startRotX, 6);

        design.dispose();
        disposeTemplate(template);
      }
    }
  });

  it("keeps both lab and worldmap GPU sail shaders strictly forward of their masts", () => {
    const out = new Vector3();
    const prevTime = mapAnimationTime.value;
    try {
      for (const army of classes) {
        for (const tier of tiers) {
          const template = createProceduralShipTemplate(army, tier);
          const design = createShipDesign(template, army, tier);
          design.setWind(2);
          const sail = design.object.getObjectByName("Sail_0") as Mesh;
          const sailNode = (sail.material as Material & { positionNode: unknown }).positionNode;
          const pos = sail.geometry.attributes.position;
          const uv = sail.geometry.attributes.uv;
          const clearance = sail.geometry.attributes.aMastClearanceZ;

          for (let i = 0; i < pos.count; i++) {
            expect(pos.getZ(i)).toBeLessThan(clearance.getX(i) - 0.05);
          }

          for (let frame = 0; frame <= 24; frame++) {
            design.animate(frame / 4, true);
            for (let i = 0; i < pos.count; i++) {
              evaluatePositionNode(
                sailNode,
                {
                  position: [pos.getX(i), pos.getY(i), pos.getZ(i)],
                  uv: [uv.getX(i), uv.getY(i)],
                  mastClearanceZ: clearance.getX(i),
                },
                out,
              );
              expect(out.z).toBeLessThanOrEqual(clearance.getX(i) + 1e-6);
            }
          }

          const worldTemplate = createProceduralShipTemplate(army, tier);
          bakeShipWorldScale(worldTemplate);
          const worldSail = worldTemplate.getObjectByName("Sail_0") as Mesh;
          const worldPennant = worldTemplate.getObjectByName("Pennant_0") as Mesh;
          const worldSailMat = createOwnershipSailMaterial(worldSail.material as MeshStandardMaterial);
          const worldPennantMat = createOwnershipPennantMaterial(worldPennant.material as MeshStandardMaterial);
          expect(worldSailMat.positionNode).not.toBeNull();
          expect(worldPennantMat.positionNode).not.toBeNull();

          const bakedPos = worldSail.geometry.attributes.position;
          const bakedUv = worldSail.geometry.attributes.uv;
          const bakedClearance = worldSail.geometry.attributes.aMastClearanceZ;

          mapAnimationTime.value = 1.5;
          let maxWorldBillow = 0;
          for (let i = 0; i < bakedPos.count; i++) {
            const restZ = bakedPos.getZ(i);
            const worldClearanceZ = -bakedClearance.getX(i) * SHIP_WORLD_SCALE;
            expect(restZ).toBeGreaterThan(worldClearanceZ + 0.01);
            evaluatePositionNode(
              worldSailMat.positionNode,
              {
                position: [bakedPos.getX(i), bakedPos.getY(i), restZ],
                uv: [bakedUv.getX(i), bakedUv.getY(i)],
                mastClearanceZ: bakedClearance.getX(i),
              },
              out,
            );
            expect(out.z).toBeGreaterThanOrEqual(restZ - 1e-6);
            maxWorldBillow = Math.max(maxWorldBillow, out.z - restZ);
          }
          expect(maxWorldBillow).toBeGreaterThan(0.02);

          worldSailMat.dispose();
          worldPennantMat.dispose();
          disposeTemplate(worldTemplate);
          design.dispose();
          disposeTemplate(template);
        }
      }
    } finally {
      mapAnimationTime.value = prevTime;
    }
  });

  it("binds independent player sail prints to the shader colorNode while preserving the shared texture owner", () => {
    const template = createProceduralShipTemplate("knight", 3);
    const first = createShipDesign(template, "knight", 3);
    const second = createShipDesign(template, "knight", 3);
    const print = new Texture();
    const disposed = vi.fn();
    print.addEventListener("dispose", disposed);

    first.setSailPrint(print, "#123456");
    second.setSailPrint(null, "#abcdef");

    const firstSailMaterial = (first.object.getObjectByName("Sail_0") as Mesh).material as Material & {
      colorNode: unknown;
    };
    const secondSailMaterial = (second.object.getObjectByName("Sail_0") as Mesh).material as Material & {
      colorNode: unknown;
    };
    const firstBound = findBoundPrintTexture(firstSailMaterial.colorNode);
    const secondBound = findBoundPrintTexture(secondSailMaterial.colorNode);

    expect(firstBound).toBe(print);
    expect(secondBound).not.toBe(print);
    expect(secondBound).not.toBeNull();
    expect((secondBound as Texture & { isDataTexture?: boolean }).isDataTexture).toBe(true);

    first.setSailPrint(null, "#123456");
    expect(findBoundPrintTexture(firstSailMaterial.colorNode)).toBe(secondBound);

    first.dispose();
    second.dispose();
    disposeTemplate(template);
    expect(disposed).not.toHaveBeenCalled();
  });

  it("preserves shared source resources and releases each clone once", () => {
    const asset = createProceduralShipTemplate("paladin", 3);
    const original = asset.getObjectByName("FleetHull") as Mesh;
    const positions = Array.from(original.geometry.attributes.position.array);
    const sourceDisposed = vi.fn();
    const cloneDisposed = vi.fn();
    original.geometry.addEventListener("dispose", sourceDisposed);

    const design = createShipDesign(asset, "paladin", 3);
    design.object.traverse((object) => {
      if (object instanceof Mesh) object.geometry.addEventListener("dispose", cloneDisposed);
    });
    design.animate(2, true);
    design.setWireframe(true);
    design.dispose();
    const calls = cloneDisposed.mock.calls.length;
    design.dispose();

    expect(calls).toBe(3);
    expect(cloneDisposed).toHaveBeenCalledTimes(calls);
    expect(Array.from(original.geometry.attributes.position.array)).toEqual(positions);
    expect((original.material as Material & { wireframe: boolean }).wireframe).toBe(false);
    expect(sourceDisposed).not.toHaveBeenCalled();
    disposeTemplate(asset);
  });

  it("retires all shipped fleet GLBs under public/models/ships", () => {
    const shipsDir = fileURLToPath(new URL("../../../../public/models/ships", import.meta.url));
    const remaining = existsSync(shipsDir) ? readdirSync(shipsDir).filter((file) => file.endsWith(".glb")) : [];
    expect(remaining).toEqual([]);
  });
});
