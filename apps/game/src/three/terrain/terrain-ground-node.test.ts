import {
  HalfFloatType,
  Mesh,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  WebGLCoordinateSystem,
  type Material,
} from "three";
import { context } from "three/tsl";
import * as ThreeWebGPU from "three/webgpu";
import { describe, expect, it } from "vitest";

import { createDeepFloorMaterial, DEEP_FLOOR } from "./deep-floor-material";
import { GroundLights } from "./ground-lights";
import { createLayerFloorMaterial } from "./layer-floor-material";
import { TerrainBiomeMap } from "./terrain-biome-map";
import { createTerrainMaterials } from "./terrain-material";

type WebGLNodeBuilder = {
  camera: PerspectiveCamera;
  build: () => void;
  fragmentShader: string;
};

type WebGLBackendConstructor = new () => {
  createNodeBuilder: (object: Mesh, renderer: unknown) => WebGLNodeBuilder;
};

function compileWebGLFragmentShader(material: Material): string {
  const mesh = new Mesh(new PlaneGeometry(), material);
  const WebGLBackend = (ThreeWebGPU as unknown as { WebGLBackend: WebGLBackendConstructor }).WebGLBackend;
  const backend = new WebGLBackend();
  const renderer = {
    contextNode: context(),
    lighting: { enabled: false },
    debug: { diagnostics: { keywords: false } },
    backend,
    coordinateSystem: WebGLCoordinateSystem,
    outputColorSpace: SRGBColorSpace,
    currentColorSpace: SRGBColorSpace,
    toneMapping: NoToneMapping,
    shadowMap: { enabled: false, type: PCFShadowMap },
    nodes: { getForRenderCacheKey: () => "" },
    isWebGPURenderer: true,
    hasFeature: () => false,
    getMaxAnisotropy: () => 1,
    getRenderTarget: () => null,
    getCurrentRenderTarget: () => null,
    getMRT: () => null,
    getDrawingBufferSize: (out: { set: (w: number, h: number) => unknown }) => out.set(1, 1),
    getPixelRatio: () => 1,
    getClearColor: (color: unknown) => color,
    getClearAlpha: () => 1,
    getOutputBufferType: () => HalfFloatType,
    library: {
      fromMaterial: (candidate: unknown) => candidate,
      getLightNode: () => null,
      getLightsNode: () => null,
      getFogNode: () => null,
      getToneMappingFunction: () => null,
    },
  };
  const builder = backend.createNodeBuilder(mesh, renderer);
  builder.camera = new PerspectiveCamera();
  builder.build();
  mesh.geometry.dispose();
  return builder.fragmentShader;
}

function findFloatArrayIndices(glsl: string): string[] {
  const floatVars = new Set<string>();
  for (const match of glsl.matchAll(/\bfloat\s+(nodeVar\d+)\s*;/g)) {
    floatVars.add(match[1]!);
  }
  const bad: string[] = [];
  for (const match of glsl.matchAll(/\b(buffer\d+\s*\[\s*([^\]]+?)\s*\])/g)) {
    const indexExpr = match[2]!.trim();
    if (floatVars.has(indexExpr)) bad.push(match[1]!);
  }
  return bad;
}

describe("WebGL fallback terrain fragment shaders", () => {
  it("index uniform arrays with integer expressions in surface, layer and Deep terrain shaders", () => {
    const biomeMap = new TerrainBiomeMap();
    const lights = new GroundLights();
    const surface = createTerrainMaterials(biomeMap.texture, lights);
    const veil = createLayerFloorMaterial(1, biomeMap.texture);
    const hollow = createLayerFloorMaterial(2, biomeMap.texture);
    const deep = createDeepFloorMaterial(DEEP_FLOOR);

    try {
      const surfaceGlsl = compileWebGLFragmentShader(surface.land);
      expect(surfaceGlsl).toMatch(/\bbuffer\d+\s*\[/);
      expect(findFloatArrayIndices(surfaceGlsl)).toEqual([]);

      const veilGlsl = compileWebGLFragmentShader(veil);
      expect(veilGlsl).toMatch(/\bbuffer\d+\s*\[/);
      expect(findFloatArrayIndices(veilGlsl)).toEqual([]);

      const hollowGlsl = compileWebGLFragmentShader(hollow);
      expect(hollowGlsl).toMatch(/\bbuffer\d+\s*\[/);
      expect(findFloatArrayIndices(hollowGlsl)).toEqual([]);

      const deepGlsl = compileWebGLFragmentShader(deep);
      expect(deepGlsl.length).toBeGreaterThan(0);
      expect(findFloatArrayIndices(deepGlsl)).toEqual([]);
    } finally {
      surface.land.dispose();
      surface.water.dispose();
      veil.dispose();
      hollow.dispose();
      deep.dispose();
      biomeMap.dispose();
      lights.dispose();
    }
  });
});
