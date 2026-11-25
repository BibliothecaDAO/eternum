import type { Camera, Object3D } from "three";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import type Node from "three/src/nodes/core/Node.js";
import {
  dot,
  emissive,
  mix,
  mrt,
  output,
  pass,
  renderOutput,
  screenCoordinate,
  screenUV,
  smoothstep,
  vec3,
  vec4,
} from "three/tsl";
import { RenderPipeline, type WebGPURenderer } from "three/webgpu";
import { cellHash } from "./terrain/terrain-cell-hash";

const GLOW = { strength: 0.35, radius: 0.3, threshold: 0.15 };
const SHADE_TINT = vec3(0.94, 0.98, 1.06);
const LIGHT_TINT = vec3(1.05, 1.0, 0.92);
const SATURATION = 1.1;
const VIGNETTE = 0.18;

export class MapFinish {
  private finish: Finish | undefined;

  constructor(private readonly renderer: WebGPURenderer) {}

  render(scene: Object3D, camera: Camera): void {
    this.finish ??= createFinish(this.renderer, scene, camera);
    this.finish.render(scene, camera);
  }

  dispose(): void {
    this.finish?.dispose();
    this.finish = undefined;
  }
}

interface Finish {
  render(scene: Object3D, camera: Camera): void;
  dispose(): void;
}

function createFinish(renderer: WebGPURenderer, scene: Object3D, camera: Camera): Finish {
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  const colour = scenePass.getTextureNode("output");
  const glow = bloom(scenePass.getTextureNode("emissive"), GLOW.strength, GLOW.radius, GLOW.threshold);
  const lit = colour.add(asColour(glow));
  const toned = renderOutput(vec4(afternoon(lit.rgb), 1));
  const smoothed = smaa(toned);
  const dither = cellHash(screenCoordinate.xy, 7).sub(0.5).div(255);
  const pipeline = new RenderPipeline(renderer as unknown as ConstructorParameters<typeof RenderPipeline>[0]);
  pipeline.outputColorTransform = false;
  pipeline.outputNode = asColour(smoothed).add(vec4(dither, dither, dither, 0));
  return {
    render: (shown, viewer) => {
      scenePass.scene = shown;
      scenePass.camera = viewer;
      pipeline.render();
    },
    dispose: () => [pipeline, scenePass, glow, smoothed].forEach((owned) => releasable(owned).dispose()),
  };
}

const asColour = (node: object) => node as unknown as Node<"vec4">;
const releasable = (node: object) => node as unknown as { dispose(): void };

function afternoon(colour: Node<"vec3">): Node<"vec3"> {
  const luma = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  const tinted = colour.mul(mix(SHADE_TINT, LIGHT_TINT, smoothstep(0.05, 0.6, luma)));
  const rich = mix(vec3(dot(tinted, vec3(0.2126, 0.7152, 0.0722))), tinted, SATURATION);
  const corner = screenUV.sub(0.5).length();
  return rich.mul(
    corner
      .mul(corner)
      .mul(VIGNETTE * 2)
      .oneMinus(),
  );
}
