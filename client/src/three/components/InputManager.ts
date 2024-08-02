import * as THREE from "three";

type ListenerTypes = "click" | "mousemove" | "contextmenu" | "dblclick" | "mouseup" | "mousedown";

export class InputManager {
  private listeners: Array<{ event: ListenerTypes; handler: (e: MouseEvent) => void }> = [];
  private isDragged = false;
  private mouseX = 0; // Add this flag
  private mouseY = 0;

  constructor(private raycaster: THREE.Raycaster, private mouse: THREE.Vector2, private camera: THREE.Camera) {
    window.addEventListener("mousedown", this.handleMouseDown.bind(this));
    window.addEventListener("mouseup", this.handleMouseUp.bind(this));
  }

  addListener(event: ListenerTypes, callback: (raycaster: THREE.Raycaster) => void): void {
    const handler = (e: MouseEvent) => {
      if (event === "click") {
        if (this.isDragged) {
          this.isDragged = false;
          return;
        }
      }
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

  private handleMouseDown(e: MouseEvent): void {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }

  private handleMouseUp(e: MouseEvent) {
    if (this.mouseX - e.clientX > 10 || this.mouseY - e.clientY > 10) this.isDragged = true;
  }
}
