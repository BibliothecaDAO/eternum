import type { Camera, Object3D } from "three";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import type Node from "three/src/nodes/core/Node.js";
import {
  dot,
  emissive,
  hash,
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

/** How much the glow of lava, embers and lit windows spreads, how far, and from how bright. */
const GLOW = { strength: 0.35, radius: 0.3, threshold: 0.15 };
/** The afternoon: shade a little cool, light a little warm, colour a little richer, the corners a little darker. */
const SHADE_TINT = vec3(0.94, 0.98, 1.06);
const LIGHT_TINT = vec3(1.05, 1.0, 0.92);
const SATURATION = 1.1;
const VIGNETTE = 0.18;

/**
 * The map's finish (renderer-aaa-2, step 1): what glows blooms, the frame is graded to the afternoon, tone-mapped, its
 * edges smoothed, and its gradients dithered so no band shows on a phone's 8-bit screen. One pipeline for each scene and
 * camera it has drawn; the overlay passes still draw over it afterwards.
 */
export class MapFinish {
  private readonly pipelines = new Map<Object3D, { camera: Camera; pipeline: RenderPipeline }>();

  constructor(private readonly renderer: WebGPURenderer) {}

  render(scene: Object3D, camera: Camera): void {
    let entry = this.pipelines.get(scene);
    if (!entry || entry.camera !== camera) {
      entry?.pipeline.dispose();
      entry = { camera, pipeline: createFinish(this.renderer, scene, camera) };
      this.pipelines.set(scene, entry);
    }
    entry.pipeline.render();
  }

  dispose(): void {
    this.pipelines.forEach(({ pipeline }) => pipeline.dispose());
    this.pipelines.clear();
  }
}

function createFinish(renderer: WebGPURenderer, scene: Object3D, camera: Camera): RenderPipeline {
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  const colour = scenePass.getTextureNode("output");
  const glow = bloom(scenePass.getTextureNode("emissive"), GLOW.strength, GLOW.radius, GLOW.threshold);
  const lit = colour.add(asColour(glow));
  const toned = renderOutput(vec4(afternoon(lit.rgb), 1));
  const smoothed = smaa(toned);
  // Half a step of an 8-bit channel, different on every pixel: gradients break into grain instead of bands.
  const dither = hash(screenCoordinate.xy).sub(0.5).div(255);
  const pipeline = new RenderPipeline(renderer as unknown as ConstructorParameters<typeof RenderPipeline>[0]);
  pipeline.outputColorTransform = false;
  pipeline.outputNode = asColour(smoothed).add(vec4(dither, dither, dither, 0));
  return pipeline;
}

/** The display addons' nodes, typed against an older three than the core's nodes: the same nodes at run time. */
const asColour = (node: object) => node as unknown as Node<"vec4">;

/** The grade, on linear light before the tone curve. */
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
