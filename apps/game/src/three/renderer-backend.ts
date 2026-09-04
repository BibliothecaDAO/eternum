import type { Camera, Object3D, Scene, Texture } from "three";
import type {
  RendererBackendV2,
  RendererFramePipeline,
  RendererPostProcessController,
  RendererPostProcessPlan,
} from "./renderer-backend-v2";

export interface RendererInfoLike {
  autoReset?: boolean;
  reset(): void;
  render: {
    calls: number;
    drawCalls?: number;
    triangles: number;
  };
  memory: {
    geometries: number;
    textures: number;
  };
  programs?: unknown[] | null;
}

export interface RendererSurfaceLike {
  autoClear: boolean;
  clear(): void;
  clearDepth(): void;
  domElement: HTMLCanvasElement;
  dispose(): void;
  info: RendererInfoLike;
  initTexture?(texture: Texture): void;
  outputColorSpace?: string;
  render(scene: Object3D, camera: Camera): void;
  compileAsync?(object: Object3D, camera: Camera, targetScene?: Scene | null): Promise<unknown>;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number): void;
  shadowMap: {
    enabled: boolean;
    type: number;
  };
  toneMapping: number;
  toneMappingExposure: number;
}

export interface EnvironmentSceneTarget {
  setEnvironment(environment: Texture, intensity: number): void;
}

export interface RendererEnvironmentTargets {
  fastTravelScene?: EnvironmentSceneTarget;
  hexceptionScene: EnvironmentSceneTarget;
  intensity: number;
  worldmapScene: EnvironmentSceneTarget;
}

interface RendererBackend extends RendererBackendV2 {
  readonly renderer: RendererSurfaceLike;
  applyEnvironment(targets: RendererEnvironmentTargets): Promise<void>;
  applyPostProcessPlan(plan: RendererPostProcessPlan): RendererPostProcessController;
  applyRenderVisuals(input: { pixelRatio: number; shadows: boolean; width: number; height: number }): void;
  dispose(): void;
  renderFrame(pipeline: RendererFramePipeline): void;
  resize(width: number, height: number): void;
}

export type RendererBackendFactory = (options: { isMobileDevice: boolean; pixelRatio: number }) => RendererBackend;
