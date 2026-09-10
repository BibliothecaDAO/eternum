import { afterEach, expect, it, vi } from "vitest";
import { awaitLocalScenePresentable } from "./local-scene-presentation";

afterEach(() => vi.restoreAllMocks());

it("compiles only once the grid and ground textures have settled, then resolves", async () => {
  const order: string[] = [];
  let buildGrid!: () => void;
  const gridBuilt = new Promise<void>((resolve) => (buildGrid = resolve)).then(() => void order.push("grid"));
  const groundTextures = Promise.reject(new Error("textures offline")).catch(() => void order.push("textures"));
  const compile = vi.fn(async () => void order.push("compile"));
  const presentable = awaitLocalScenePresentable({ gridBuilt, groundTextures, compile });
  await Promise.resolve();
  expect(compile).not.toHaveBeenCalled();
  buildGrid();
  await presentable;
  expect(order).toEqual(["textures", "grid", "compile"]);
});

it("still resolves when the warm-up itself fails", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await expect(
    awaitLocalScenePresentable({
      gridBuilt: Promise.resolve(),
      groundTextures: Promise.resolve(),
      compile: async () => {
        throw new Error("device lost");
      },
    }),
  ).resolves.toBeUndefined();
  expect(console.warn).toHaveBeenCalledOnce();
});
