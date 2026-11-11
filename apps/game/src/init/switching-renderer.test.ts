import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it, vi } from "vitest";

import { createSwitchingRenderer } from "./switching-renderer";

const setup = {} as GameClientSetup;

function world(first: "map" | "game") {
  const made: Array<{
    which: string;
    initScene: ReturnType<typeof vi.fn>;
    initStats: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];
  const make = (which: string) => () => {
    const renderer = { which, initScene: vi.fn(async () => {}), initStats: vi.fn(), destroy: vi.fn() };
    made.push(renderer);
    return renderer;
  };
  const state = { picked: first as "map" | "game", changed: () => {}, stopped: vi.fn(), switches: vi.fn() };
  const renderer = createSwitchingRenderer(setup, {
    create: { map: make("map"), game: make("game") },
    pick: () => state.picked,
    watch: (changed) => {
      state.changed = changed;
      return state.stopped;
    },
    onSwitch: state.switches,
  });
  const pick = async (which: "map" | "game") => {
    state.picked = which;
    state.changed();
    await vi.waitFor(() => expect(made.at(-1)!.initScene).toHaveBeenCalled());
    await Promise.resolve();
  };
  return { made, state, renderer, pick };
}

describe("createSwitchingRenderer", () => {
  it("starts the renderer picked at the start and no other", async () => {
    const { made, renderer } = world("map");
    await renderer.initScene();

    expect(made.map((one) => one.which)).toEqual(["map"]);
    expect(made[0].initScene).toHaveBeenCalledOnce();
  });

  it("destroys the renderer that drew and starts the other when the pick changes, and says the view is changing", async () => {
    const { made, state, renderer, pick } = world("map");
    await renderer.initScene();

    await pick("game");

    expect(made.map((one) => one.which)).toEqual(["map", "game"]);
    expect(made[0].destroy).toHaveBeenCalledOnce();
    expect(made[1].initScene).toHaveBeenCalledOnce();
    expect(state.switches).toHaveBeenCalledOnce();
  });

  it("goes back when the pick goes back", async () => {
    const { made, renderer, pick } = world("map");
    await renderer.initScene();

    await pick("game");
    await pick("map");

    expect(made.map((one) => one.which)).toEqual(["map", "game", "map"]);
    expect(made[1].destroy).toHaveBeenCalledOnce();
    expect(made[2].destroy).not.toHaveBeenCalled();
  });

  it("does nothing when told of a change that leaves the pick as it was", async () => {
    const { made, state, renderer } = world("game");
    await renderer.initScene();

    state.changed();

    expect(made).toHaveLength(1);
    expect(state.switches).not.toHaveBeenCalled();
  });

  it("takes up a pick that changed back while the other renderer was starting", async () => {
    const { made, state, renderer } = world("map");
    await renderer.initScene();
    state.picked = "game";
    state.changed();
    // The game's renderer is starting; before it has, the pick is the map again.
    state.picked = "map";
    state.changed();

    await vi.waitFor(() => expect(made).toHaveLength(3));

    expect(made.map((one) => one.which)).toEqual(["map", "game", "map"]);
    expect(made[1].destroy).toHaveBeenCalledOnce();
  });

  it("opens the monitors of whichever renderer draws once they were asked for", async () => {
    const { made, renderer, pick } = world("map");
    await renderer.initScene();
    renderer.initStats();

    await pick("game");

    expect(made[0].initStats).toHaveBeenCalledOnce();
    expect(made[1].initStats).toHaveBeenCalledOnce();
  });

  it("destroys the renderer that draws, stops watching, and switches no more once it is destroyed", async () => {
    const { made, state, renderer } = world("map");
    await renderer.initScene();

    renderer.destroy();
    state.picked = "game";
    state.changed();

    expect(made).toHaveLength(1);
    expect(made[0].destroy).toHaveBeenCalledOnce();
    expect(state.stopped).toHaveBeenCalledOnce();
  });
});
