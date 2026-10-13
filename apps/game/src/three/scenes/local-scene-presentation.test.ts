import { expect, it } from "vitest";
import { awaitLocalScenePresentable } from "./local-scene-presentation";

it("is presentable once the grid is built, whether or not the ground textures loaded", async () => {
  let buildGrid!: () => void;
  const gridBuilt = new Promise<void>((resolve) => (buildGrid = resolve));
  const groundTextures = Promise.reject(new Error("textures offline"));
  let presentable = false;
  const waiting = awaitLocalScenePresentable({ gridBuilt, groundTextures }).then(() => (presentable = true));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(presentable).toBe(false);
  buildGrid();
  await waiting;
  expect(presentable).toBe(true);
});

it("fails when the grid failed to build, so the scene's setup fails with it", async () => {
  await expect(
    awaitLocalScenePresentable({
      gridBuilt: Promise.reject(new Error("Integer out of range in TileOpt.row")),
      groundTextures: Promise.resolve(),
    }),
  ).rejects.toThrow("Integer out of range in TileOpt.row");
});
