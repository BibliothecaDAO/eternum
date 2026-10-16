declare module "*.svg" {
  import * as React from "react";

  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;

  export default ReactComponent;
}

declare module "jolt-physics/jolt-physics.wasm.wasm?url" {
  const wasmUrl: string;
  export default wasmUrl;
}

declare module "three/webgpu" {
  export * from "three";
  export { default as MeshBasicNodeMaterial } from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
  export { default as MeshPhysicalNodeMaterial } from "three/src/materials/nodes/MeshPhysicalNodeMaterial.js";
  export { default as MeshStandardNodeMaterial } from "three/src/materials/nodes/MeshStandardNodeMaterial.js";

  import { InstancedBufferAttribute, type TypedArray } from "three";

  export class StorageInstancedBufferAttribute extends InstancedBufferAttribute {
    readonly isStorageInstancedBufferAttribute: true;
    constructor(count: number | TypedArray, itemSize: number);
  }

  import { Renderer } from "three";
  import type { RendererParameters } from "three/addons/renderers/common/Renderer.js";
  import PostProcessingClass from "three/src/renderers/common/PostProcessing.js";

  export interface WebGPURendererParameters extends RendererParameters {
    forceWebGL?: boolean;
  }

  export const PostProcessing: typeof PostProcessingClass;

  export class WebGPURenderer extends Renderer {
    constructor(parameters?: WebGPURendererParameters);
    init(): Promise<void>;
    outputBufferType?: number;
  }
}

declare module "three/src/renderers/common/RenderObject.js" {
  /** What the WebGPU renderer keeps per drawn object and pass; it lives until the object or a material is disposed. */
  export default class RenderObject {
    constructor(
      nodes: unknown,
      geometries: unknown,
      renderer: unknown,
      object: unknown,
      material: unknown,
      scene: unknown,
      camera: unknown,
      lightsNode: unknown,
      renderContext: unknown,
      clippingContext: unknown,
    );
    onDispose: () => void;
    readonly onMaterialDispose: () => void;
  }
}
