import * as THREE from "three";

type ListenerTypes = "click" | "mousemove" | "contextmenu" | "dblclick";

export class InputManager {
  private listeners: Array<{ event: ListenerTypes; handler: (e: MouseEvent) => void }> = [];
  constructor(private raycaster: THREE.Raycaster, private mouse: THREE.Vector2, private camera: THREE.Camera) {}

  addListener(event: ListenerTypes, callback: (raycaster: THREE.Raycaster) => void): void {
    const handler = (e: MouseEvent) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      callback(this.raycaster);
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
}
