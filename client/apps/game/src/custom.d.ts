declare module "*.svg" {
  import * as React from "react";

  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;

  export default ReactComponent;
}

declare module "three/webgpu" {
  export * from "three";
  export const WebGPURenderer: any;
}
