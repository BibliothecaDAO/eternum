import { HexPosition } from "@/types";
import { TransitionManager } from "./components/TransitionManager";

type SceneName = string;

export class SceneManager {
  private currentScene: SceneName = "worldmap";
  private scenes = new Map<SceneName, any>();
  constructor(private transitionManager: TransitionManager) {}

  getCurrentScene() {
    return this.currentScene;
  }

  _updateCurrentScene(name: SceneName) {
    this.currentScene = name;
  }

  addScene(newScene: SceneName, scene: any) {
    this.scenes.set(newScene, scene);
  }

  switchScene(name: SceneName, hexCoords?: HexPosition) {
    console.log("switch scene");
    const scene = this.scenes.get(name);

    if (scene) {
      this.transitionManager.fadeOut(() => {
        this._updateCurrentScene(name);
        if (scene.setup && hexCoords) {
          scene.setup(hexCoords);
        }
        this.transitionManager.fadeIn();
      });
    }
  }
}
