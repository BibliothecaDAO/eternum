// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { TerrainSurface } from "@/three/terrain/terrain-surface";
import { InteractiveHexManager } from "./interactive-hex-manager";
import { BiomeType } from "@bibliothecadao/types";
import { plotLookOn } from "./worldmap-interaction-palette";

const GRASS = plotLookOn(BiomeType.Grassland);

const slopedGround = (rise: number): TerrainSurface => ({
  sampleSurface: (x, z) => ({ biome: null, height: rise * (x + 2 * z), normal: [0, 1, 0] as const }),
  sampleHeight: (x, z) => rise * (x + 2 * z),
});
const AT_ORIGIN = {
  positionForHex: () => new THREE.Vector3(),
  positionForHexInto: (_col: number, _row: number, out: THREE.Vector3) => out.set(0, 0, 0),
  hexForPosition: () => ({ col: 0, row: 0 }),
};

const bandOf = (scene: THREE.Scene) =>
  scene.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.visible)?.geometry;

const drawnPlot = (ground: TerrainSurface) => {
  const scene = new THREE.Scene();
  const manager = new InteractiveHexManager(scene, ground, AT_ORIGIN as never);
  manager.applyPlotLook(GRASS);
  manager.addHex({ col: 0, row: 0 });
  manager.renderAllHexes();
  return { scene, manager };
};

describe("a buildable hex's band", () => {
  it("lies on the ground under every point of it, so it neither floats over a dip nor sinks under a rise", () => {
    const ground = slopedGround(0.2);
    const positions = bandOf(drawnPlot(ground).scene)!.getAttribute("position");
    expect(positions.count).toBeGreaterThan(0);
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const under = ground.sampleSurface(positions.getX(vertex), positions.getZ(vertex)).height;
      expect(positions.getY(vertex) - under).toBeCloseTo(0.03, 6);
    }
  });

  it("leaves a plot a building stands on bare, still a plot to tap, and draws it again once the building goes", () => {
    const { scene, manager } = drawnPlot(slopedGround(0));
    const drawn = bandOf(scene)!.getAttribute("position").count;

    manager.setBandBare({ col: 0, row: 0 }, true);
    manager.renderAllHexes();
    expect(bandOf(scene)).toBeUndefined();
    expect(manager.isHexInteractive({ col: 0, row: 0 })).toBe(true);

    manager.setBandBare({ col: 0, row: 0 }, false);
    manager.renderAllHexes();
    expect(bandOf(scene)!.getAttribute("position").count).toBe(drawn);
  });

  it("draws no band where its surface is hidden, as on the world map, and still picks its hexes", () => {
    const scene = new THREE.Scene();
    const manager = new InteractiveHexManager(scene, slopedGround(0.2), AT_ORIGIN as never);
    manager.setSurfaceVisibility(false);
    manager.addHex({ col: 0, row: 0 });
    manager.renderAllHexes();
    expect(bandOf(scene)).toBeUndefined();
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -1, 0));
    expect(manager.pick(raycaster)?.hexCoords).toEqual({ col: 0, row: 0 });
  });

  it("draws open plots in the look its scene gave them, the fill soft and the rim strong", () => {
    const { scene, manager } = drawnPlot(slopedGround(0));
    const mesh = scene.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh)!;
    const material = mesh.material as THREE.Material & {
      colorNode?: PlotShaderNode | null;
      opacityNode?: PlotShaderNode | null;
      opacity: number;
    };
    const positions = mesh.geometry.getAttribute("position");
    const [fillExpected, rimExpected] = [GRASS.fill, GRASS.rim].map(([r, g, b]) => new THREE.Color(r, g, b));
    let fillCount = 0;
    let rimCount = 0;
    for (let index = 0; index < positions.count; index += 1) {
      const drawnRgb = evaluatePlotNode(material.colorNode, mesh.geometry, material, index);
      const [drawnAlpha] = evaluatePlotNode(material.opacityNode, mesh.geometry, material, index);
      const isFill = Math.abs(drawnAlpha - GRASS.fill[3]) < 1e-4;
      const expectedRgb = isFill ? fillExpected : rimExpected;
      expect(drawnRgb[0]).toBeCloseTo(expectedRgb.r, 4);
      expect(drawnRgb[1]).toBeCloseTo(expectedRgb.g, 4);
      expect(drawnRgb[2]).toBeCloseTo(expectedRgb.b, 4);
      expect(drawnAlpha).toBeCloseTo(isFill ? GRASS.fill[3] : GRASS.rim[3], 4);
      if (isFill) fillCount += 1;
      else rimCount += 1;
    }
    expect(fillCount).toBe(37);
    expect(rimCount).toBe(36);
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
