import { afterEach, describe, expect, it, vi } from "vitest";

const KNIGHT_LABEL = "T1 Knight Default";

async function renderViews(gymKind: "archer" | "crossbowman" | "knight" | "paladin" = "knight") {
  vi.resetModules();
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  vi.doMock("react-router-dom", () => ({ Link: ({ children }: { children?: unknown }) => children }));
  const { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } = await import("@/three/characters");
  const { CharacterGymControls } = await import("./procedural-character-gym-controls");
  const { ProceduralCharacterBenchmarkView } = await import("./procedural-character-benchmark-view");
  const noop = () => undefined;
  return {
    benchmark: renderToStaticMarkup(createElement(ProceduralCharacterBenchmarkView)),
    gym: renderToStaticMarkup(
      createElement(CharacterGymControls, {
        collisionConfig: {} as never,
        config: applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: gymKind }),
        copied: false,
        selectedPreset: "custom",
        onApplyPreset: noop,
        onCopyConfig: noop,
        onPatchCollisionConfig: noop,
        onPatchConfig: noop,
        onResetCamera: noop,
      }),
    ),
  };
}

afterEach(() => window.history.replaceState(null, "", "/"));

describe("offered character appearances", { timeout: 60_000 }, () => {
  it("offers the Knight skin for Knights, without offering it for incompatible mixed armies", async () => {
    const { benchmark, gym } = await renderViews();
    expect(gym).toContain(KNIGHT_LABEL);
    expect(benchmark).not.toContain(KNIGHT_LABEL);
  });

  it("does not list it in the gym for a unit kind that cannot use it", async () => {
    for (const kind of ["archer", "crossbowman", "paladin"] as const) {
      const { gym } = await renderViews(kind);
      expect(gym).toContain("Universal base body");
      expect(gym).not.toContain(KNIGHT_LABEL);
    }
  });
});
