import { SceneName } from "@/types";
import * as THREE from "three";
import { SceneManager } from "../SceneManager";

type ListenerTypes = "click" | "mousemove" | "contextmenu" | "dblclick" | "mouseup" | "mousedown";

export class InputManager {
  private listeners: Array<{ event: ListenerTypes; handler: (e: MouseEvent) => void }> = [];
  private isDragged = false;
  private mouseX = 0; // Add this flag
  private mouseY = 0;
  private clickTimer: NodeJS.Timeout | null = null; // Add this property

  constructor(
    private sceneName: SceneName,
    private sceneManager: SceneManager,
    private raycaster: THREE.Raycaster,
    private mouse: THREE.Vector2,
    private camera: THREE.Camera,
  ) {
    window.addEventListener("mousedown", this.handleMouseDown.bind(this));
    window.addEventListener("mouseup", this.handleMouseUp.bind(this));
  }

  addListener(event: ListenerTypes, callback: (raycaster: THREE.Raycaster) => void): void {
    const handler = (e: MouseEvent) => {
      if (this.sceneManager.getCurrentScene() !== this.sceneName) {
        return;
      }

      if (event === "click") {
        if (this.isDragged) {
          this.isDragged = false;
          return;
        }
        // Check if a double-click occurred
        if (this.clickTimer) {
          clearTimeout(this.clickTimer);
          this.clickTimer = null;
          return; // Suppress the click event
        }
        // Set a timer to check for double-click
        this.clickTimer = setTimeout(() => {
          this.clickTimer = null;
          this.raycaster.setFromCamera(this.mouse, this.camera);
          callback(this.raycaster);
        }, 200); // Adjust the delay as needed
      } else {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        callback(this.raycaster);
      }
    };
    this.listeners.push({ event, handler });
    window.addEventListener(event, handler);
  }

  restartListeners(): void {
    for (const listener of this.listeners) {
      window.addEventListener(listener.event, listener.handler);
    }
  }

  pauseListeners(): void {
    for (const listener of this.listeners) {
      window.removeEventListener(listener.event, listener.handler);
    }
  }

  public changeScene(sceneName: SceneName): void {
    this.sceneName = sceneName;
  }

  private handleMouseDown(e: MouseEvent): void {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }

  private handleMouseUp(e: MouseEvent) {
    if (this.mouseX - e.clientX > 10 || this.mouseY - e.clientY > 10) this.isDragged = true;
  }
}
