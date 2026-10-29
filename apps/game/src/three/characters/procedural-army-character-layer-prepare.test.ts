import { Scene } from "three";
import { expect, it, vi } from "vitest";

const runtimeReady = vi.hoisted(() => {
  let resolve: (runtime: unknown) => void = () => {};
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
});

vi.mock("@/three/characters", () => ({
  ProceduralUnitRuntime: { create: () => runtimeReady.promise },
  createDefaultProceduralUnitConfig: () => ({ humanoid: {} }),
}));

const { ProceduralArmyCharacterLayer } = await import("./procedural-army-character-layer");
const { whenModelPreparationSettles } = await import("@/three/model-preparation");

it("holds the entry's model preparation until the armies' character runtime exists, with no army in view", async () => {
  const layer = new ProceduralArmyCharacterLayer(new Scene());
  layer.prepare();
  let settled: string | null = null;
  void whenModelPreparationSettles(5_000).then((result) => (settled = result));
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(settled).toBeNull();

  runtimeReady.resolve({ updatePhysicsConfig: () => {}, dispose: () => {} });
  await vi.waitFor(() => expect(settled).toBe("settled"));
  expect(layer.getStats().loadState).toBe("ready");
  layer.dispose();
});
