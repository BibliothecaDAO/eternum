import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";

/** What the game's renderer session asks of a renderer. */
interface SessionRenderer {
  initScene(): Promise<void>;
  initStats(): void;
  destroy(): void;
}

interface SwitchingRendererInput<Which extends string> {
  /** How each renderer is made. */
  create: Record<Which, (setup: GameClientSetup) => SessionRenderer>;
  /** Which renderer should draw as things stand: asked at the start, and again whenever `watch` says so. */
  pick: () => Which;
  /** Tells when the pick may have changed; returns how to stop being told. */
  watch: (changed: () => void) => () => void;
  /** Called as one renderer is about to give way to another, so the page can show that the view is changing. */
  onSwitch: () => void;
}

/**
 * One renderer to the game's renderer session that is in turn each of several: whichever `pick` names draws, and
 * when the pick changes that one is destroyed and the other started in its place, in the same page. A pick that
 * changes while a renderer is starting is taken up as soon as that start ends; a session cleaned up while a
 * renderer is starting destroys it as it arrives.
 */
export function createSwitchingRenderer<Which extends string>(
  setup: GameClientSetup,
  { create, pick, watch, onSwitch }: SwitchingRendererInput<Which>,
): SessionRenderer {
  let drawing = pick();
  let renderer = create[drawing](setup);
  let stopWatching: (() => void) | null = null;
  let switching = false;
  let destroyed = false;
  let statsOpen = false;

  const reconsider = (): void => {
    if (destroyed || switching || pick() === drawing) return;
    switching = true;
    onSwitch();
    renderer.destroy();
    drawing = pick();
    renderer = create[drawing](setup);
    const started = renderer;
    void started
      .initScene()
      .then(() => {
        if (destroyed) return;
        if (statsOpen) started.initStats();
      })
      .catch((reason) => console.error("The renderer could not take over the view:", reason))
      .finally(() => {
        switching = false;
        reconsider();
      });
  };

  return {
    async initScene() {
      await renderer.initScene();
      if (destroyed) return;
      stopWatching = watch(reconsider);
      reconsider();
    },
    initStats() {
      statsOpen = true;
      renderer.initStats();
    },
    destroy() {
      destroyed = true;
      stopWatching?.();
      renderer.destroy();
    },
  };
}
