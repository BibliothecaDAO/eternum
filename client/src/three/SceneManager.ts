import { TransitionManager } from "./components/TransitionManager";

export type SceneName = string;

export class SceneManager {
  public currentScene: SceneName = "worldmap";
  private scenes = new Map<SceneName, any>();
  constructor(private transitionManager: TransitionManager) {}

  _updateCurrentScene(name: SceneName) {
    this.currentScene = name;
  }

  addScene(newScene: SceneName, scene: any) {
    this.scenes.set(newScene, scene);
  }

  switchScene(name: SceneName) {
    console.log("switch scene");
    const scene = this.scenes.get(name);

    if (scene) {
      this.transitionManager.fadeOut(() => {
        this._updateCurrentScene(name);
        if (scene.setup) {
          scene.setup();
        }
        this.transitionManager.fadeIn();
      });
    }
  }
}
