import type { WebGPURenderer } from "three/webgpu";
import { expectTypeOf, it } from "vitest";

import type { RendererBackend } from "./renderer-backend";

// The type check (pnpm typecheck) fails these, not the test run: an `any` here would hide every renderer call from it.
it("keeps three's WebGPU renderer and the backend's capabilities typed", () => {
  expectTypeOf<WebGPURenderer>().not.toBeAny();
  expectTypeOf<RendererBackend["capabilities"]>().not.toBeAny();
  expectTypeOf<RendererBackend["capabilities"]["supportsToneMappingControl"]>().toEqualTypeOf<boolean>();
});
