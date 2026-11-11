import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";

/** What the game's renderer session asks of a renderer. */
interface SessionRenderer {
  initScene(): Promise<void>;
  initStats(): void;
  destroy(): void;
}

/**
 * The map client's renderer as the game's renderer session takes it, with its code fetched only when its scene is
 * started: a page that never asks for this map never loads it. A session cleaned up while the code is on its way
 * never builds the renderer.
 */
export function createLazyMapRenderer(
  setup: GameClientSetup,
  load: () => Promise<new (setup: GameClientSetup) => SessionRenderer> = async () =>
    (await import("./map-renderer")).MapClientRenderer,
): SessionRenderer {
  let renderer: SessionRenderer | null = null;
  let destroyed = false;
  return {
    async initScene() {
      const Renderer = await load();
      if (destroyed) return;
      renderer = new Renderer(setup);
      await renderer.initScene();
    },
    initStats: () => renderer?.initStats(),
    destroy() {
      destroyed = true;
      renderer?.destroy();
    },
  };
}
