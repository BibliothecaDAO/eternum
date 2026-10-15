import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { measureFrameChanges } from "./frames.mjs";

let dir;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** A 10×10 grey frame, with `lit` pixels (by index) white. */
const writeFrame = (index, lit = []) => {
  const pixels = Buffer.alloc(100, 60);
  for (const pixel of lit) pixels[pixel] = 255;
  return sharp(pixels, { raw: { width: 10, height: 10, channels: 1 } })
    .png()
    .toFile(join(dir, `frame-${String(index).padStart(4, "0")}.png`));
};

describe("a still view's frame changes", () => {
  it("counts the pixels that change between frames, and maps how often each one did", async () => {
    dir = mkdtempSync(join(tmpdir(), "frames-"));
    // Pixel 0 flickers on every frame; pixel 99 changes once; the rest never do.
    await writeFrame(1, [0]);
    await writeFrame(2, []);
    await writeFrame(3, [0]);
    await writeFrame(4, [99]);

    const changes = await measureFrameChanges(dir, join(dir, "changes.png"));

    expect(changes).toEqual({
      frames: 4,
      pairs: 3,
      changedShare: { medianPercent: 1, maxPercent: 2, meanPercent: 1.3333 },
      changedPairs: 3,
    });
    const map = await sharp(join(dir, "changes.png")).extractChannel(0).raw().toBuffer();
    expect([map[0], map[99], map[50]]).toEqual([255, 85, 0]);
  });

  it("reads only the region asked for", async () => {
    dir = mkdtempSync(join(tmpdir(), "frames-"));
    await writeFrame(1, [0]);
    await writeFrame(2, [99]);

    const changes = await measureFrameChanges(dir, join(dir, "changes.png"), { left: 5, top: 5, width: 5, height: 5 });

    expect(changes).toMatchObject({ pairs: 1, changedPairs: 1, changedShare: { maxPercent: 4 } });
  });
});
