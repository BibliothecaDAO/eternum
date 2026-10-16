// @vitest-environment jsdom
import GUI from "lil-gui";
import {
  ACESFilmicToneMapping,
  CineonToneMapping,
  LinearToneMapping,
  NeutralToneMapping,
  NoToneMapping,
  ReinhardToneMapping,
} from "three";
import { expect, it, vi } from "vitest";
import { setupRendererDevGui } from "./renderer-dev-gui-runtime";

it("keeps supported tone mapping and exposure bound to the renderer without post-processing", () => {
  const root = new GUI();
  const renderer = { toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.8 };
  try {
    setupRendererDevGui({
      contactShadowOpacity: 0.2,
      createFolder: (name) => root.addFolder(name),
      moveCameraToColRow: vi.fn(),
      moveCameraToXYZ: vi.fn(),
      renderer,
      switchScene: vi.fn(),
      updateContactShadowOpacity: vi.fn(),
    });
    const mode = root.controllersRecursive().find((control) => control.property === "toneMapping")!;
    const exposure = root.controllersRecursive().find((control) => control.property === "toneMappingExposure")!;
    for (const value of [
      NoToneMapping,
      LinearToneMapping,
      ReinhardToneMapping,
      CineonToneMapping,
      NeutralToneMapping,
      ACESFilmicToneMapping,
    ]) {
      mode.setValue(value);
      expect(renderer.toneMapping).toBe(value);
    }
    exposure.setValue(1.25);
    expect(renderer.toneMappingExposure).toBe(1.25);
    expect(root.folders.map((folder) => folder._title)).toEqual([
      "Switch scene",
      "Move Camera",
      "Renderer",
      "Contact Shadows",
    ]);
  } finally {
    root.destroy();
  }
});
