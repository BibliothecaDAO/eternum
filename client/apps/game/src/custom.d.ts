declare module "*.svg" {
  import * as React from "react";

  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;

  export default ReactComponent;
}

declare module "three/webgpu" {
  export * from "three";

  import { Renderer } from "three";
  import type { RendererParameters } from "three/examples/jsm/renderers/common/Renderer.js";

  export interface WebGPURendererParameters extends RendererParameters {
    forceWebGL?: boolean;
  }

  export class WebGPURenderer extends Renderer {
    constructor(parameters?: WebGPURendererParameters);
    init(): Promise<void>;
    outputBufferType?: number;
  }
}
