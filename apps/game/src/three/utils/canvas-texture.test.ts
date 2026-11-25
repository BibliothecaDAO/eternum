import { afterEach, expect, it, vi } from "vitest";

import { createCanvasTexture } from "./canvas-texture";

afterEach(() => vi.unstubAllGlobals());

it("draws a texture's canvas on the CPU, so uploading it never waits on the GPU", () => {
  const context = { kind: "2d" };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) };
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });

  const made = createCanvasTexture(256, 512);

  expect(canvas.getContext).toHaveBeenCalledWith("2d", { willReadFrequently: true });
  expect(made.context).toBe(context);
  expect(made.texture.image).toBe(canvas);
  expect(canvas).toMatchObject({ width: 256, height: 512 });
});
