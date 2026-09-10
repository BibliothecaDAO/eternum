import { afterEach, expect, it, vi } from "vitest";
import { awaitLocalScenePresentable } from "./local-scene-presentation";

afterEach(() => vi.restoreAllMocks());

const never = () => {};

it("compiles only once the grid and ground textures have settled, then resolves", async () => {
  const order: string[] = [];
  let buildGrid!: () => void;
  const gridBuilt = new Promise<void>((resolve) => (buildGrid = resolve)).then(() => void order.push("grid"));
  const groundTextures = Promise.reject(new Error("textures offline")).catch(() => void order.push("textures"));
  const compile = vi.fn(async () => void order.push("compile"));
  const presentable = awaitLocalScenePresentable({ gridBuilt, groundTextures, compile, setTimeoutFn: never });
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
      setTimeoutFn: never,
    }),
  ).resolves.toBeUndefined();
  expect(console.warn).toHaveBeenCalledOnce();
});

it("reveals when the warm-up outlives its budget and lets it finish in the background", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  let elapse!: () => void;
  const presentable = awaitLocalScenePresentable({
    gridBuilt: Promise.resolve(),
    groundTextures: Promise.resolve(),
    compile: () => new Promise(() => {}),
    budgetMs: 1_500,
    setTimeoutFn: (callback, delayMs) => {
      expect(delayMs).toBe(1_500);
      elapse = callback;
    },
  });
  // The budget timer is armed after the grid and textures settle, a few microtasks in.
  await new Promise((resolve) => setTimeout(resolve, 0));
  elapse();
  await expect(presentable).resolves.toBeUndefined();
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("outlived its 1500ms budget"));
});
