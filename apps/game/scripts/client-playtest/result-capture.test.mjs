import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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

/** The page's frames, every 16 ms from 0 to 400. */
const PAGE_FRAMES = Array.from({ length: 26 }, (_, index) => index * FRAME_MS);
/** A page frame every `frameMs` round `visible`, for a run kept without its page's frames. */
const steadyFrames = (frameMs, visible) => Array.from({ length: 81 }, (_, index) => visible + (index - 40) * frameMs);

/** Frames every 16 ms from 0 to 400, the facts arriving at 100 and the result marked at 160. */
const capture = (lit) => Promise.all(PAGE_FRAMES.map((t) => frameAt(t, lit)));
const prove = async (lit, pageFrames = PAGE_FRAMES) =>
  proveResultOnScreen({ frames: await capture(lit), region, before: 100, visible: 160, pageFrames, dir });

describe("proveResultOnScreen", () => {
  it("holds when the result's pixels show at its mark", async () => {
    const proof = await prove({ resultAt: 160 });
    expect(proof).toMatchObject({ shown: true, lagMs: 0, resultPercent: 50 });
  });

  it("holds on a still page, whose frames stop once the result is shown", async () => {
    const frames = (await capture({ resultAt: 160 })).filter((frame) => frame.t <= 160);
    const proof = await proveResultOnScreen({
      frames,
      region,
      before: 100,
      visible: 160,
      pageFrames: PAGE_FRAMES,
      dir,
    });
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

/** A 40×40 frame, dark, lit from `resultAt`, then the same pixels mid-grey from `laterAt` (page ms). */
const relitFrameAt = async (t, { resultAt, laterAt }) => {
  const level = t >= laterAt ? 120 : t >= resultAt ? 220 : 20;
  const jpeg = await sharp(Buffer.alloc(40 * 40, level), { raw: { width: 40, height: 40, channels: 1 } })
    .jpeg({ quality: 90 })
    .toBuffer();
  return { t, width: 40, jpeg };
};

describe("proveResultOnScreen on a place that changes again after the result", () => {
  const proveRelit = async (lit, onset) =>
    proveResultOnScreen({
      frames: await Promise.all(PAGE_FRAMES.map((t) => relitFrameAt(t, lit))),
      region,
      onset,
      before: 100,
      visible: 160,
      pageFrames: PAGE_FRAMES,
      dir,
    });

  it("holds the result from its first change, its place's last look being another's", async () => {
    expect(await proveRelit({ resultAt: 160, laterAt: 320 }, true)).toMatchObject({ shown: true, lagMs: 0 });
    expect(await proveRelit({ resultAt: 160, laterAt: 320 }, false)).toMatchObject({ shown: false });
  });

  it("fails it when nothing changed there by three frames after its mark", async () => {
    expect(await proveRelit({ resultAt: 320, laterAt: 360 }, true)).toMatchObject({ shown: false });
  });
});

/**
 * The page's frames round a mark at 160 with one slow frame after it (192 to 292): review 6's counterexample, where a
 * window sized by the slowest frame accepted a result seven frames late and one three frames early. What a frame paints
 * is on screen as the next one starts.
 */
describe("proveResultOnScreen's window on uneven frames", () => {
  const unevenFrames = [96, 112, 128, 144, 160, 176, 192, 292, 308, 324, 340, 356, 372, 388];
  const proveUneven = async (resultAt) =>
    proveResultOnScreen({
      frames: await Promise.all(unevenFrames.map((t) => frameAt(t, { resultAt }))),
      region,
      before: 100,
      visible: 160,
      pageFrames: unevenFrames,
      dir,
    });

  it("fails a result first shown seven frames after its mark", async () => {
    expect(await proveUneven(356)).toMatchObject({ shown: false });
  });

  it("fails a result already shown three frames before its mark", async () => {
    expect(await proveUneven(112)).toMatchObject({ shown: false, lagMs: -48 });
  });

  it("holds a result painted by the third frame after its mark, however slow that frame", async () => {
    expect(await proveUneven(308)).toMatchObject({ shown: true, lagMs: 148 });
  });

  it("fails a result painted by the fourth frame after its mark", async () => {
    expect(await proveUneven(324)).toMatchObject({ shown: false });
  });

  it("holds a result painted a frame before its mark, and fails one painted two before", async () => {
    expect(await proveUneven(160)).toMatchObject({ shown: true, lagMs: 0 });
    expect(await proveUneven(144)).toMatchObject({ shown: false, lagMs: -16 });
  });
});

/**
 * An explore's frames, cropped to its tile's ground inside the outline (fixtures/explore-reveal): the reviewer's run
 * where the old proof passed an unexplored tile (review 4), and a whole reveal captured frame by frame.
 */
const exploreFrames = (run) => {
  const dir = new URL(`./fixtures/explore-reveal/${run}/`, import.meta.url);
  const marks = JSON.parse(readFileSync(new URL("marks.json", dir), "utf8"));
  const frames = readdirSync(dir)
    .filter((name) => name.endsWith(".jpg"))
    .map((name) => ({ t: Number(name.slice(1, -4)), width: 64, jpeg: readFileSync(new URL(name, dir)) }))
    .sort((left, right) => left.t - right.t);
  return { frames, marks };
};
const ground = { left: 0, top: 0, width: 64, height: 50 };
const proveExplore = ({ frames, marks }, markedLater = 0) =>
  proveResultOnScreen({
    frames,
    region: ground,
    target: ground,
    before: marks.diff,
    visible: marks.visible + markedLater,
    pageFrames: steadyFrames(marks.frameMs, marks.visible + markedLater),
    dir,
  });

describe("proveResultOnScreen on a target's state", () => {
  it("fails an explore whose tile is still fog three frames after its mark, whatever changed round it", async () => {
    const proof = await proveExplore(exploreFrames("review-4-desktop-1"));
    expect(proof).toMatchObject({
      shown: false,
      reason: "three frames after its mark its target still read as before",
    });
  });

  it("fails a reveal marked when its terrain committed, and holds it marked once half its fog has cleared", async () => {
    const reveal = exploreFrames("whole-reveal-desktop");
    expect(await proveExplore(reveal)).toMatchObject({ shown: false });
    expect(await proveExplore(reveal, 150)).toMatchObject({ shown: true, firstShownAt: 16100 });
  });

  it("fails a target that never changed", async () => {
    const frames = await capture({ laterAt: 300 });
    const proof = await proveResultOnScreen({
      frames,
      region,
      target: { left: 0, top: 0, width: 20, height: 40 },
      before: 100,
      visible: 160,
      pageFrames: PAGE_FRAMES,
      dir,
    });
    expect(proof).toMatchObject({ shown: false });
    expect(proof.reason).toMatch(/never changed/);
  });

  it("fails a chest whose body has not begun to open three frames after its mark, the sheet beside it changing", async () => {
    const run = new URL("./fixtures/chest-opening/review-5-phone-1/", import.meta.url);
    const marks = JSON.parse(readFileSync(new URL("marks.json", run), "utf8"));
    const frames = readdirSync(run)
      .filter((name) => name.endsWith(".jpg"))
      .map((name) => ({ t: Number(name.slice(1, -4)), width: 50, jpeg: readFileSync(new URL(name, run)) }))
      .sort((left, right) => left.t - right.t);
    const body = { left: 0, top: 0, width: 50, height: 40 };
    const proof = await proveResultOnScreen({
      frames,
      region: body,
      target: body,
      onset: true,
      before: marks.diff,
      visible: marks.visible,
      pageFrames: steadyFrames(marks.frameMs, marks.visible),
      dir,
    });
    expect(proof).toMatchObject({
      shown: false,
      reason: "three frames after its mark its target still read as before",
    });
  });

  it("holds a target set moving at its mark, whatever its last look", async () => {
    const frames = await capture({ resultAt: 160 });
    const proof = await proveResultOnScreen({
      frames,
      region,
      target: { left: 0, top: 0, width: 20, height: 40 },
      onset: true,
      before: 100,
      visible: 160,
      pageFrames: PAGE_FRAMES,
      dir,
    });
    expect(proof).toMatchObject({ shown: true, lagMs: 0 });
  });
});
