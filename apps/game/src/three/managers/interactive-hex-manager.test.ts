// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { TerrainSurface } from "@/three/terrain/terrain-surface";
import { InteractiveHexManager } from "./interactive-hex-manager";
import { REALM_PLOT_PALETTE } from "./worldmap-interaction-palette";

// Flat ground with one rise away from the hex's centre, under its edge.
const groundWithRisingEdge = (rise: number): TerrainSurface => ({
  sampleSurface: (x, z) => ({ biome: null, height: Math.hypot(x, z) > 0.5 ? rise : 0, normal: [0, 1, 0] as const }),
});
const AT_ORIGIN = {
  positionForHex: () => new THREE.Vector3(),
  positionForHexInto: (_col: number, _row: number, out: THREE.Vector3) => out.set(0, 0, 0),
  hexForPosition: () => ({ col: 0, row: 0 }),
};

const bandHeight = (manager: InteractiveHexManager, scene: THREE.Scene): number => {
  manager.addHex({ col: 0, row: 0 });
  manager.renderAllHexes();
  const mesh = scene.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)!;
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(0, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix).y;
};

describe("a buildable hex's band", () => {
  it("lies clear of the highest ground under its edge, so relief never buries part of the line", () => {
    const scene = new THREE.Scene();
    const manager = new InteractiveHexManager(scene, groundWithRisingEdge(0.4), AT_ORIGIN as never);
    expect(bandHeight(manager, scene)).toBeGreaterThan(0.4);
  });

  it("leaves a plot a building stands on bare, still a plot to tap, and draws it again once the building goes", () => {
    const scene = new THREE.Scene();
    const manager = new InteractiveHexManager(scene, groundWithRisingEdge(0), AT_ORIGIN as never);
    manager.addHex({ col: 0, row: 0 });
    manager.setBandBare({ col: 0, row: 0 }, true);
    manager.renderAllHexes();
    const mesh = scene.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)!;
    const drawnScale = () => {
      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(0, matrix);
      return new THREE.Vector3()
        .setFromMatrixScale(matrix)
        .toArray()
        .map((axis) => Math.round(axis * 1e6) / 1e6 + 0);
    };

    expect(drawnScale()).toEqual([0, 0, 0]);
    expect(manager.isHexInteractive({ col: 0, row: 0 })).toBe(true);

    manager.setBandBare({ col: 0, row: 0 }, false);
    manager.renderAllHexes();
    expect(drawnScale()).toEqual([1, 1, 1]);
  });

  it("only reads its centre where it is not drawn", () => {
    const scene = new THREE.Scene();
    const manager = new InteractiveHexManager(scene, groundWithRisingEdge(0.4), AT_ORIGIN as never);
    manager.setSurfaceVisibility(false);
    expect(bandHeight(manager, scene)).toBeLessThan(0.4);
  });

  it("draws open plots with the palette's green fill and rim alpha and zeroes drawn alpha when hidden", () => {
    const scene = new THREE.Scene();
    const manager = new InteractiveHexManager(scene, groundWithRisingEdge(0), AT_ORIGIN as never);
    manager.addHex({ col: 0, row: 0 });
    manager.renderAllHexes();
    const mesh = scene.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)!;
    const material = mesh.material as THREE.Material & {
      colorNode?: PlotShaderNode | null;
      opacityNode?: PlotShaderNode | null;
      opacity: number;
    };
    const positions = mesh.geometry.getAttribute("position");
    const fillExpected = new THREE.Color(REALM_PLOT_PALETTE.fill);
    const rimExpected = new THREE.Color(REALM_PLOT_PALETTE.rim);
    let fillCount = 0;
    let rimCount = 0;
    for (let tri = 0; tri < positions.count; tri += 3) {
      const isFill = [0, 1, 2].some(
        (offset) => Math.hypot(positions.getX(tri + offset), positions.getY(tri + offset)) < 1e-6,
      );
      const expectedRgb = isFill ? fillExpected : rimExpected;
      const expectedAlpha = isFill ? REALM_PLOT_PALETTE.fillOpacity : REALM_PLOT_PALETTE.rimOpacity;
      for (let offset = 0; offset < 3; offset += 1) {
        const index = tri + offset;
        const drawnRgb = evaluatePlotNode(material.colorNode, mesh.geometry, material, index);
        const [drawnAlpha] = evaluatePlotNode(material.opacityNode, mesh.geometry, material, index);
        expect(drawnRgb[1]).toBeGreaterThan(drawnRgb[0]);
        expect(drawnRgb[1]).toBeGreaterThan(drawnRgb[2]);
        expect(drawnRgb[0]).toBeCloseTo(expectedRgb.r, 4);
        expect(drawnRgb[1]).toBeCloseTo(expectedRgb.g, 4);
        expect(drawnRgb[2]).toBeCloseTo(expectedRgb.b, 4);
        expect(drawnAlpha).toBeCloseTo(expectedAlpha, 4);
        if (isFill) fillCount += 1;
        else rimCount += 1;
      }
    }
    expect(fillCount).toBe(18);
    expect(rimCount).toBe(36);

    manager.setSurfaceVisibility(false);
    for (let index = 0; index < positions.count; index += 1) {
      const [hiddenAlpha] = evaluatePlotNode(material.opacityNode, mesh.geometry, material, index);
      expect(hiddenAlpha).toBe(0);
    }
    manager.destroy();
  });
});

type PlotShaderNode = {
  type?: string;
  node?: PlotShaderNode;
  components?: string;
  _attributeName?: string;
  nodeType?: string | null;
  scope?: string;
  op?: string;
  aNode?: PlotShaderNode;
  bNode?: PlotShaderNode;
  value?: unknown;
};

const CHANNEL_INDEX: Record<string, number> = { x: 0, y: 1, z: 2, w: 3, r: 0, g: 1, b: 2, a: 3 };

function evaluatePlotNode(
  node: PlotShaderNode | null | undefined,
  geometry: THREE.BufferGeometry,
  material: { opacity: number },
  vertexIndex: number,
): number[] {
  if (!node) throw new Error("Missing plot shader node");
  if (node.type === "VaryingNode" || node.type === "SubBuild" || node.type === "VarNode") {
    return evaluatePlotNode(node.node, geometry, material, vertexIndex);
  }
  if (node.type === "AttributeNode") {
    const attribute = geometry.getAttribute(node._attributeName ?? "");
    if (!attribute) throw new Error(`Missing geometry attribute ${node._attributeName}`);
    const width =
      node.nodeType === "vec4" ? 4 : node.nodeType === "vec3" ? 3 : node.nodeType === "vec2" ? 2 : attribute.itemSize;
    if (attribute.itemSize < width) throw new Error(`Attribute ${node._attributeName} has width ${attribute.itemSize}`);
    return Array.from({ length: width }, (_, channel) => attribute.array[vertexIndex * attribute.itemSize + channel]!);
  }
  if (node.type === "SplitNode") {
    const source = evaluatePlotNode(node.node, geometry, material, vertexIndex);
    return [...(node.components ?? "")].map((component) => {
      const index = CHANNEL_INDEX[component];
      if (index === undefined || index >= source.length) {
        throw new Error(`Channel ${component} unavailable on ${source.length}-component node`);
      }
      return source[index]!;
    });
  }
  if (node.type === "MaterialNode" && node.scope === "opacity") return [material.opacity];
  if (typeof node.value === "number") return [node.value];
  if (node.type === "OperatorNode") {
    const left = evaluatePlotNode(node.aNode, geometry, material, vertexIndex);
    const right = evaluatePlotNode(node.bNode, geometry, material, vertexIndex);
    const length = Math.max(left.length, right.length);
    return Array.from({ length }, (_, index) => {
      const a = left[Math.min(index, left.length - 1)]!;
      const b = right[Math.min(index, right.length - 1)]!;
      if (node.op === "*") return a * b;
      if (node.op === "+") return a + b;
      if (node.op === "-") return a - b;
      if (node.op === "/") return a / b;
      throw new Error(`Unsupported plot shader operator ${node.op}`);
    });
  }
  throw new Error(`Unsupported plot shader node ${String(node.type)}`);
}
