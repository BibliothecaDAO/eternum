// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CentralizedShortcutManager } from "@/utils/shortcuts/centralized-shortcut-manager";
import { advanceGameEnd, resetGameEnd } from "../effects/endgame/state";
import type { SceneManager } from "../scene-manager";
import { SceneName } from "../types/common";
import { SceneShortcutManager } from "./shortcuts";

const scenes: SceneShortcutManager[] = [];
afterEach(() => {
  scenes.splice(0).forEach((scene) => scene.cleanup());
  CentralizedShortcutManager.getInstance().destroy();
  resetGameEnd();
});

function registerSceneShortcuts(currentScene: SceneName) {
  const sceneManager = { getCurrentScene: () => currentScene } as SceneManager;
  const actions = new Map<SceneName, ReturnType<typeof vi.fn>>();
  for (const scene of [SceneName.WorldMap, SceneName.Hexception]) {
    const shortcuts = new SceneShortcutManager(scene, sceneManager);
    const action = vi.fn();
    shortcuts.registerShortcut({
      id: "escape-handler",
      key: "Escape",
      description: "Back out of the scene",
      sceneRestriction: scene,
      action,
    });
    scenes.push(shortcuts);
    actions.set(scene, action);
  }
  const press = (key: string) => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event;
  };
  return { actions, press };
}

describe.each([SceneName.WorldMap, SceneName.Hexception])("%s production shortcuts", (scene) => {
  it("skips the ending on Escape, then takes the next Escape as the normal back-out", () => {
    const { actions, press } = registerSceneShortcuts(scene);
    advanceGameEnd(1, false, 0);
    advanceGameEnd(1, true, 0.4);

    expect(press("Escape").defaultPrevented).toBe(true);
    expect(advanceGameEnd(1, true, 0)).toMatchObject({ seconds: 9, finished: true });
    for (const action of actions.values()) expect(action).not.toHaveBeenCalled();

    expect(press("Escape").defaultPrevented).toBe(true);
    expect(actions.get(scene)).toHaveBeenCalledOnce();
    for (const [name, action] of actions) if (name !== scene) expect(action).not.toHaveBeenCalled();
  });

  it("keeps normal Escape behavior in a live game", () => {
    const { actions, press } = registerSceneShortcuts(scene);
    advanceGameEnd(1, false, 0);

    expect(press("Escape").defaultPrevented).toBe(true);
    expect(advanceGameEnd(1, false, 0).phase).toBe("live");
    expect(actions.get(scene)).toHaveBeenCalledOnce();
    for (const [name, action] of actions) if (name !== scene) expect(action).not.toHaveBeenCalled();
  });

  it("keeps normal Escape behavior when opening an already-ended game", () => {
    const { actions, press } = registerSceneShortcuts(scene);
    advanceGameEnd(1, true, 0);

    press("Escape");
    expect(advanceGameEnd(1, true, 0).finished).toBe(true);
    expect(actions.get(scene)).toHaveBeenCalledOnce();
  });
});
