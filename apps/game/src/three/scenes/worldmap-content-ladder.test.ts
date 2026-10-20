import { describe, expect, it } from "vitest";

import { CameraView } from "./camera-view";
import { resolveWorldmapContentLadder } from "./worldmap-content-ladder";

describe("resolveWorldmapContentLadder", () => {
  it("renders everything near, every label in the mid band too (plan D), and only icons far", () => {
    expect(resolveWorldmapContentLadder(CameraView.Close)).toMatchObject({
      structureModels: true,
      armyModels: true,
      // Legacy army models are the one representation while the procedural characters are iterated on.
      proceduralCharacters: false,
      fx: true,
      labels: true,
      entityIcons: false,
    });
    expect(resolveWorldmapContentLadder(CameraView.Medium)).toMatchObject({
      structureModels: true,
      proceduralCharacters: false,
      labels: true,
      entityIcons: false,
    });
    expect(resolveWorldmapContentLadder(CameraView.Far)).toMatchObject({
      structureModels: false,
      armyModels: false,
      proceduralCharacters: false,
      fx: false,
      labels: false,
      entityIcons: true,
    });
  });
});
