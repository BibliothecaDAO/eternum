import type { WebGPURenderer } from "three/webgpu";

import type { RendererBackendV2 } from "./renderer-backend-v2";

type AssertTrue<T extends true> = T;
type AssertFalse<T extends false> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;

type WebGpuRendererType = WebGPURenderer;
type BackendCapabilitiesType = RendererBackendV2["capabilities"];

type _webGpuRendererIsTyped = AssertFalse<IsAny<WebGpuRendererType>>;
type _backendCapabilitiesAreTyped = AssertFalse<IsAny<BackendCapabilitiesType>>;
type _toneMappingCapabilityIsBoolean = AssertTrue<
  BackendCapabilitiesType["supportsToneMappingControl"] extends boolean ? true : false
>;

export type ThreeWebGpuTypeGuard = {
  backendCapabilities: BackendCapabilitiesType;
  rendererType: WebGpuRendererType;
};
