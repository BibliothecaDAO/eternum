import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it, vi } from "vitest";

import { createLazyMapRenderer } from "./lazy-map-renderer";

const setup = {} as GameClientSetup;

function fakeRendererClass() {
  const made: Array<{
    initScene: ReturnType<typeof vi.fn>;
    initStats: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];
  class Renderer {
    initScene = vi.fn(async () => {});
    initStats = vi.fn();
    destroy = vi.fn();
    constructor(readonly given: GameClientSetup) {
      made.push(this);
    }
  }
  return { Renderer, made };
}

describe("createLazyMapRenderer", () => {
  it("loads nothing until its scene is started, then builds the renderer with the game's setup and starts it", async () => {
    const { Renderer, made } = fakeRendererClass();
    const load = vi.fn(async () => Renderer);
    const renderer = createLazyMapRenderer(setup, load);

    expect(load).not.toHaveBeenCalled();
    await renderer.initScene();

    expect(load).toHaveBeenCalledTimes(1);
    expect(made).toHaveLength(1);
    expect(made[0].initScene).toHaveBeenCalledTimes(1);
  });

  it("never builds the renderer when it is destroyed while the code is on its way", async () => {
    const { Renderer, made } = fakeRendererClass();
    let arrive!: () => void;
    const load = () => new Promise<typeof Renderer>((done) => (arrive = () => done(Renderer)));
    const renderer = createLazyMapRenderer(setup, load);

    const starting = renderer.initScene();
    renderer.destroy();
    arrive();
    await starting;

    expect(made).toHaveLength(0);
  });

  it("passes the monitors and the cleanup on to the renderer it built", async () => {
    const { Renderer, made } = fakeRendererClass();
    const renderer = createLazyMapRenderer(setup, async () => Renderer);
    await renderer.initScene();

    renderer.initStats();
    renderer.destroy();

    expect(made[0].initStats).toHaveBeenCalledTimes(1);
    expect(made[0].destroy).toHaveBeenCalledTimes(1);
  });
});
