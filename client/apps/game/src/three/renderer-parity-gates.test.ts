import { describe, expect, it } from "vitest";

import { evaluateRendererParityGates, REQUIRED_RENDERER_PARITY_FEATURES } from "./renderer-parity-gates";

describe("REQUIRED_RENDERER_PARITY_FEATURES", () => {
  it("locks the required parity surfaces to environment ibl and tone mapping control", () => {
    expect(REQUIRED_RENDERER_PARITY_FEATURES).toEqual(["environmentIbl", "toneMappingControl"]);
  });
});

describe("evaluateRendererParityGates", () => {
  it("treats unsupported optional post-fx as advisory only", () => {
    expect(
      evaluateRendererParityGates([
        { feature: "colorGrade", reason: "unsupported-backend" },
        { feature: "bloom", reason: "unsupported-backend" },
        { feature: "vignette", reason: "unsupported-backend" },
        { feature: "chromaticAberration", reason: "unsupported-backend" },
      ]),
    ).toEqual({
      advisory: [
        { feature: "colorGrade", reason: "unsupported-backend" },
        { feature: "bloom", reason: "unsupported-backend" },
        { feature: "vignette", reason: "unsupported-backend" },
        { feature: "chromaticAberration", reason: "unsupported-backend" },
      ],
      blocking: [],
      ok: true,
    });
  });

  it("treats required parity gaps as rollout blockers", () => {
    expect(
      evaluateRendererParityGates([
        { feature: "toneMappingControl", reason: "unsupported-backend" },
        {
          detail: "Using scene key/fill fallback lighting policy at target environment intensity 0.45",
          feature: "environmentIbl",
          reason: "unsupported-backend",
        },
        { feature: "bloom", reason: "unsupported-backend" },
      ]),
    ).toEqual({
      advisory: [{ feature: "bloom", reason: "unsupported-backend" }],
      blocking: [
        { feature: "toneMappingControl", reason: "unsupported-backend" },
        {
          detail: "Using scene key/fill fallback lighting policy at target environment intensity 0.45",
          feature: "environmentIbl",
          reason: "unsupported-backend",
        },
      ],
      ok: false,
    });
  });
});
