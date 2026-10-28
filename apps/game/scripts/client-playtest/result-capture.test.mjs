import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { proveResultOnScreen } from "./result-capture.mjs";

let dir;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "result-capture-"))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const FRAME_MS = 16;
const region = { left: 0, top: 0, width: 40, height: 40 };

/** A 40×40 frame, dark, with its left half lit from `resultAt` and its right half lit from `laterAt` (page ms). */
const frameAt = async (t, { resultAt = Infinity, laterAt = Infinity } = {}) => {
  const pixels = Buffer.alloc(40 * 40, 20);
  for (let y = 0; y < 40; y += 1) {
    for (let x = 0; x < 40; x += 1) {
      if ((x < 20 && t >= resultAt) || (x >= 20 && t >= laterAt)) pixels[y * 40 + x] = 220;
    }
  }
  const jpeg = await sharp(pixels, { raw: { width: 40, height: 40, channels: 1 } })
    .jpeg({ quality: 90 })
    .toBuffer();
  return { t, width: 40, jpeg };
};

/** Frames every 16 ms from 0 to 400, the facts arriving at 100 and the result marked at 160. */
const capture = (lit) => Promise.all(Array.from({ length: 26 }, (_, index) => frameAt(index * FRAME_MS, lit)));
const prove = async (lit) =>
  proveResultOnScreen({ frames: await capture(lit), region, before: 100, visible: 160, frameMs: FRAME_MS, dir });

describe("proveResultOnScreen", () => {
  it("holds when the result's pixels show at its mark", async () => {
    const proof = await prove({ resultAt: 160 });
    expect(proof).toMatchObject({ shown: true, lagMs: 0, resultPercent: 50 });
  });

  it("holds when the region changes again later, for another reason, than the result", async () => {
    const proof = await prove({ resultAt: 160, laterAt: 320 });
    expect(proof).toMatchObject({ shown: true, lagMs: 0, resultPercent: 50 });
  });

  it("fails a result the screen shows more than three frames after its mark", async () => {
    const proof = await prove({ resultAt: 160 + 5 * FRAME_MS });
    expect(proof.shown).toBe(false);
    expect(proof.reason).toBe("three frames after its mark only 0% of its region showed it");
  });

  it("fails a result the screen never shows", async () => {
    expect((await prove({})).shown).toBe(false);
  });

  it("fails a mark that comes after the screen already showed the result", async () => {
    const proof = await prove({ resultAt: 160 - 3 * FRAME_MS });
    expect(proof).toMatchObject({ shown: false, lagMs: -48, reason: "the screen showed it 48ms before its mark" });
  });
});
