// @vitest-environment node
import { describe, expect, it } from "vitest";

import { orderTerrainContactSheetFilenames } from "./terrain-verification/create-terrain-contact-sheet.mjs";

describe("terrain contact sheet", () => {
  it("discovers every capture deterministically and excludes its own output", () => {
    expect(
      orderTerrainContactSheetFilenames(
        ["z-notes.json", "tropical-webgpu-auto.png", "contact-sheet.png", "arid-webgpu-force-webgl.png"],
        "contact-sheet.png",
      ),
    ).toEqual(["arid-webgpu-force-webgl.png", "tropical-webgpu-auto.png"]);
  });
});
