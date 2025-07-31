import { useUIStore } from "@/hooks/store/use-ui-store";
import { SceneManager } from "@/three/scene-manager";
import * as THREE from "three";
import { SceneName } from "../types";

type ListenerTypes = "click" | "mousemove" | "contextmenu" | "dblclick" | "mousedown";

export class InputManager {
  private listeners: Array<{ event: ListenerTypes; handler: (e: MouseEvent) => void }> = [];
  private isDragged = false;

  constructor(
    private sceneName: SceneName,
    private sceneManager: SceneManager,
    private raycaster: THREE.Raycaster,
    private mouse: THREE.Vector2,
    private camera: THREE.Camera,
  ) {
    window.addEventListener("mousedown", this.handleMouseDown.bind(this));
  }

  addListener(event: ListenerTypes, callback: (raycaster: THREE.Raycaster) => void): void {
    const handler = (e: MouseEvent) => {
      if (this.sceneManager.getCurrentScene() !== this.sceneName) {
        return;
      }

      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      if (event === "click") {
        if (this.isDragged) {
          this.isDragged = false;
          return;
        }
        // Check if a double-click occurred
        callback(this.raycaster);
      } else {
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

  private handleMouseDown(e: MouseEvent): void {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    this.isDragged = false;
    const checkDrag = (e: MouseEvent) => {
      if (Math.abs(mouseX - e.clientX) > 10 || Math.abs(mouseY - e.clientY) > 10) {
        this.isDragged = true;
        // Clear tooltip when dragging starts
        useUIStore.getState().setTooltip(null);
        window.removeEventListener("mousemove", checkDrag);
      }
    };
    window.addEventListener("mousemove", checkDrag);
    window.addEventListener(
      "mouseup",
      () => {
        window.removeEventListener("mousemove", checkDrag);
      },
      { once: true },
    );
  }
}
