import { useUIStore } from "@/hooks/store/use-ui-store";
import { SceneManager } from "@/three/scene-manager";
import * as THREE from "three";
import { SceneName } from "../types";

type ListenerTypes = "click" | "mousemove" | "contextmenu" | "dblclick" | "mousedown";

export class InputManager {
  private listeners: Array<{ event: ListenerTypes; handler: (e: MouseEvent) => void }> = [];
  private isDragged = false;
  private currentDragListener: ((e: MouseEvent) => void) | null = null;
  private currentMouseUpListener: ((e: MouseEvent) => void) | null = null;
  private mouseDownHandler: (e: MouseEvent) => void;
  private surface: HTMLElement | null = null;
  private isActive = false;
  private isDestroyed = false;

  constructor(
    private sceneName: SceneName,
    private sceneManager: SceneManager,
    private raycaster: THREE.Raycaster,
    private mouse: THREE.Vector2,
    private camera: THREE.Camera,
  ) {
    this.mouseDownHandler = this.handleMouseDown.bind(this);
  }

  setSurface(surface: HTMLElement): void {
    if (this.surface === surface) {
      return;
    }

    if (this.isActive) {
      this.pauseListeners();
    }

    this.surface = surface;

    if (this.isActive) {
      this.restartListeners();
    }
  }

  activate(): void {
    if (this.isDestroyed || this.isActive) {
      return;
    }

    this.isActive = true;
    this.restartListeners();
  }

  deactivate(): void {
    if (!this.isActive) {
      return;
    }

    this.pauseListeners();
    this.cleanupDragListeners();
    this.isActive = false;
  }

  addListener(event: ListenerTypes, callback: (event: MouseEvent, raycaster: THREE.Raycaster) => void): void {
    const handler = (e: MouseEvent) => {
      if (this.sceneManager.getCurrentScene() !== this.sceneName) {
        return;
      }

      if (event === "contextmenu") {
        e.preventDefault();
      }

      const bounds = this.surface?.getBoundingClientRect();
      const width = bounds?.width || window.innerWidth;
      const height = bounds?.height || window.innerHeight;
      const left = bounds?.left || 0;
      const top = bounds?.top || 0;

      this.mouse.x = ((e.clientX - left) / width) * 2 - 1;
      this.mouse.y = -((e.clientY - top) / height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      if (event === "click") {
        if (this.isDragged) {
          this.isDragged = false;
          return;
        }
        // Check if a double-click occurred
        callback(e, this.raycaster);
      } else {
        callback(e, this.raycaster);
      }
    };
    this.listeners.push({ event, handler });
    if (this.isActive && this.surface) {
      this.surface.addEventListener(event, handler);
    }
  }

  restartListeners(): void {
    if (!this.surface) {
      return;
    }

    this.surface.addEventListener("mousedown", this.mouseDownHandler);
    for (const listener of this.listeners) {
      this.surface.addEventListener(listener.event, listener.handler);
    }
  }

  pauseListeners(): void {
    if (this.surface) {
      this.surface.removeEventListener("mousedown", this.mouseDownHandler);
    }

    for (const listener of this.listeners) {
      this.surface?.removeEventListener(listener.event, listener.handler);
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    // Clean up any existing drag listeners to prevent race conditions
    this.cleanupDragListeners();

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    this.isDragged = false;

    this.currentDragListener = (e: MouseEvent) => {
      if (Math.abs(mouseX - e.clientX) > 10 || Math.abs(mouseY - e.clientY) > 10) {
        this.isDragged = true;
        // Clear tooltip when dragging starts
        useUIStore.getState().setTooltip(null);
        this.cleanupDragListeners();
      }
    };

    this.currentMouseUpListener = () => {
      this.cleanupDragListeners();
    };

    window.addEventListener("mousemove", this.currentDragListener);
    window.addEventListener("mouseup", this.currentMouseUpListener, { once: true });
  }

  private cleanupDragListeners(): void {
    if (this.currentDragListener) {
      window.removeEventListener("mousemove", this.currentDragListener);
      this.currentDragListener = null;
    }
    if (this.currentMouseUpListener) {
      window.removeEventListener("mouseup", this.currentMouseUpListener);
      this.currentMouseUpListener = null;
    }
  }

  public destroy(): void {
    if (this.isDestroyed) {
      console.warn("InputManager already destroyed, skipping cleanup");
      return;
    }
    this.isDestroyed = true;

    // Clean up main mousedown handler
    this.deactivate();

    // Clean up any active drag listeners
    this.cleanupDragListeners();

    // Clean up all registered listeners
    for (const listener of this.listeners) {
      window.removeEventListener(listener.event, listener.handler);
    }
    this.listeners = [];

    console.log("InputManager: Destroyed and cleaned up all event listeners");
  }
}
