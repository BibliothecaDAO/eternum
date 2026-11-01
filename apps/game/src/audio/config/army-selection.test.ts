// @vitest-environment node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getAllAssets } from "./registry";

describe("army selection foley", () => {
  it("ships one reproducible, short, quiet PCM cue and no selection shouts", () => {
    execFileSync(process.execPath, ["asset-sources/army-selection/build.mjs", "--check"]);
    const assets = getAllAssets();
    const selection = assets.find(({ id }) => id === "unit.command.select")!;
    expect(selection.variations).toBeUndefined();
    expect(selection.loop).toBe(false);
    expect(selection.volume).toBe(0.5);
    expect(assets.some(({ id }) => id === "unit.selected")).toBe(false);
    for (const asset of assets) {
      expect([asset.url, ...(asset.variations ?? [])].some((url) => /army_selected[123]\.mp3/.test(url))).toBe(false);
    }
    for (const variant of [1, 2, 3]) {
      expect(existsSync(`public/sound/units/army_selected${variant}.mp3`)).toBe(false);
    }

    const wav = readFileSync(`public${selection.url}`);
    const ledger = readFileSync("public/sound/units/SOURCE.md", "utf8");
    expect(ledger).toContain(createHash("sha256").update(wav).digest("hex"));
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 16)).toBe("WAVEfmt ");
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt16LE(34)).toBe(16);
    const samples = Array.from({ length: (wav.length - 44) / 2 }, (_, i) => wav.readInt16LE(44 + i * 2) / 32768);
    expect(samples.length / wav.readUInt32LE(24)).toBe(0.16);
    const peak = Math.max(...samples.map(Math.abs));
    const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
    expect(peak).toBeCloseTo(0.25, 4);
    expect(rms).toBeGreaterThan(0.02);
    expect(rms).toBeLessThan(0.08);
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBe(0);
  });
});
