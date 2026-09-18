// @vitest-environment node
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { createResourceIconContactSheet } from "./create-resource-icon-contact-sheet.mjs";
import { normalizeIconImage, requireTransparentMaster, verifyIconImage } from "./icon-image.mjs";
import { buildResourceIconPrompt, loadResourceIconManifest, selectResourceIcons } from "./resource-icon-manifest.mjs";

describe("resource icon pipeline", () => {
  it("matches every resource enum entry to one semantic definition", async () => {
    const manifest = await loadResourceIconManifest();

    expect(manifest.resources).toHaveLength(58);
    expect(manifest.resources.find(({ enumKey }) => enumKey === "SAT")).toMatchObject({ id: 58, family: "currency" });
    expect(selectResourceIcons(manifest, true).map(({ enumKey }) => enumKey)).toEqual([
      "Stone",
      "Wood",
      "Mithral",
      "Labor",
      "Knight",
      "KnightT3",
      "StaminaRelic1",
      "StaminaRelic2",
    ]);
  });

  it("builds complete prompts from shared direction and semantic details", async () => {
    const manifest = await loadResourceIconManifest();
    const prompt = buildResourceIconPrompt(
      manifest,
      manifest.resources.find(({ enumKey }) => enumKey === "KnightT3"),
    );

    expect(prompt).toContain("elite foot knight");
    expect(prompt).toContain("genuinely transparent background");
    expect(prompt).toContain("readable at 24 pixels");
    expect(prompt).toContain("crowned closed helm");
  });

  it("normalizes a master and verifies its output contract", async () => {
    const directory = await mkdtemp(join(tmpdir(), "eternum-resource-icon-"));
    const inputPath = join(directory, "master.png");
    const outputPath = join(directory, "1.png");
    const outputContract = { format: "png", maxBytes: 131_072, size: 256, subjectSize: 220 };
    await sharp({ create: { background: "#9a6a32", channels: 4, height: 300, width: 200 } })
      .extend({ bottom: 20, left: 40, right: 40, top: 20, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(inputPath);

    await normalizeIconImage(inputPath, outputPath, outputContract);
    const verification = await verifyIconImage(outputPath, outputContract);

    expect(verification.bytes).toBeLessThan(outputContract.maxBytes);
    await expect(sharp(outputPath).metadata()).resolves.toMatchObject({ hasAlpha: true, height: 256, width: 256 });
  });

  it("rejects a simulated transparency grid before it can enter the build", async () => {
    const directory = await mkdtemp(join(tmpdir(), "eternum-resource-grid-"));
    const inputPath = join(directory, "checkerboard.png");
    await sharp({ create: { background: "#cccccc", channels: 3, height: 256, width: 256 } })
      .png()
      .toFile(inputPath);

    await expect(requireTransparentMaster(inputPath)).rejects.toThrow("master has no alpha channel");
  });

  it("creates a multi-background small-size contact sheet", async () => {
    const manifest = await loadResourceIconManifest();
    const directory = await mkdtemp(join(tmpdir(), "eternum-resource-sheet-"));
    const imageDirectory = join(directory, "images");
    const outputPath = join(directory, "contact-sheet.png");
    await mkdir(imageDirectory);
    for (const resource of selectResourceIcons(manifest, true)) {
      await sharp({ create: { background: "#9a6a32", channels: 4, height: 256, width: 256 } })
        .png()
        .toFile(join(imageDirectory, `${resource.id}.png`));
    }

    const result = await createResourceIconContactSheet({ imageDirectory, outputPath, pilotOnly: true });

    expect(result).toMatchObject({ columns: 4, count: 8, rows: 2 });
    await expect(sharp(outputPath).metadata()).resolves.toMatchObject({ height: 600, width: 1680 });
  });
});
