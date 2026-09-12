import NodeBuilder from "three/src/nodes/core/NodeBuilder.js";
import { afterEach, describe, expect, it, vi } from "vitest";

// Three's public types omit its internal build API. Exercise the installed, patched implementation.
interface BuildProbe {
  prebuild(): void;
  buildCode(): void;
  buildUpdateNodes(): void;
  buildAsync(): Promise<BuildProbe>;
}
const ProbeBuilder = NodeBuilder as unknown as new (object: null, renderer: object, parser: null) => BuildProbe;

describe("WebGPU shader build boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("yields before setup but never lets a render interrupt shader and binding generation", async () => {
    const events: string[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      events.push("yield");
      queueMicrotask(() => callback(0));
      return 1;
    });
    const builder = new ProbeBuilder(null, {}, null);
    builder.prebuild = () => {
      events.push("setup");
      // A render can reuse the material as soon as the compiler yields to the browser.
      queueMicrotask(() => events.push("render"));
    };
    builder.buildCode = () => events.push("shader");
    builder.buildUpdateNodes = () => events.push("bindings");

    await builder.buildAsync();

    expect(events).toEqual(["yield", "setup", "shader", "bindings", "render"]);
  });
});
