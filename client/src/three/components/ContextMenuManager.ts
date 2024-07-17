import * as THREE from "three";
import { Raycaster } from "three";
import HexagonMap from "../scenes/Worldmap";
import { ThreeStore } from "@/hooks/store/useThreeStore";

export class ContextMenuManager {
  private contextMenu: HTMLElement | null = null;

  private isRightMouseDown: boolean = false;
  private rightClickStartTime: number = 0;
  private rightClickStartPosition: { x: number; y: number } = { x: 0, y: 0 };

  private haloMesh: THREE.Mesh | null = null;
  private pulseAnimation: number | null = null;
  private pulseTime: number = 0;

  private hoveredHexagon: { instancedMesh: THREE.InstancedMesh; instanceId: number } | null = null;

  constructor(
    private scene: THREE.Scene,
    private raycaster: Raycaster,
    private camera: THREE.PerspectiveCamera,
    private mouse: THREE.Vector2,
    private loadedChunks: Map<string, THREE.Group>,
    private hexSize: number,
    private hexGrid: HexagonMap,
    private state: ThreeStore,
  ) {
    this.createContextMenu();
    this.addEventListeners();
  }

  private createContextMenu() {
    this.contextMenu = document.createElement("div");
    this.contextMenu.style.position = "absolute";
    this.contextMenu.style.backgroundColor = "white";
    this.contextMenu.style.border = "1px solid black";
    this.contextMenu.style.padding = "5px";
    this.contextMenu.style.display = "none";
    document.body.appendChild(this.contextMenu);

    const options = ["Option 1", "Option 2", "Option 3"];
    options.forEach((option) => {
      const button = document.createElement("button");
      button.textContent = option;
      button.addEventListener("click", () => this.handleContextMenuOption(option));
      this.contextMenu!.appendChild(button);
    });
  }

  private showContextMenuForHexagon(event: MouseEvent) {
    event.preventDefault();
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects: THREE.Intersection[] = [];
    this.loadedChunks.forEach((chunk) => {
      chunk.children.forEach((child) => {
        if (child instanceof THREE.InstancedMesh) {
          this.raycaster.intersectObject(child, false, intersects);
        }
      });
    });

    if (intersects.length > 0) {
      const hexCoords = this.hexGrid.getHexagonCoordinates(
        intersects[0].object as THREE.InstancedMesh,
        intersects[0].instanceId!,
      );
      this.showContextMenu(event.clientX, event.clientY, hexCoords);
    } else {
      this.hideContextMenu();
    }
  }

  private async showContextMenu(x: number, y: number, hexCoords: { row: number; col: number }) {
    if (this.contextMenu) {
      this.contextMenu.innerHTML = `Loading data for hexagon (${hexCoords.row}, ${hexCoords.col})...`;
      this.contextMenu.style.left = `${x}px`;
      this.contextMenu.style.top = `${y}px`;
      this.contextMenu.style.display = "block";
    }
  }

  private hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = "none";
    }
  }

  private handleContextMenuOption(option: string) {
    console.log(`Selected option: ${option}`);
    // Add your logic for handling different options here
    this.hideContextMenu();
  }

  private onMouseDown(event: MouseEvent) {
    this.state.setSelectedHex({ col: event.clientX, row: event.clientY });

    if (event.button === 2) {
      // Right mouse button
      event.preventDefault();
      this.isRightMouseDown = true;
      this.rightClickStartTime = Date.now();
      this.rightClickStartPosition = { x: event.clientX, y: event.clientY };
    }
  }

  private onMouseUp(event: MouseEvent) {
    if (event.button === 2) {
      // Right mouse button
      event.preventDefault();
      this.isRightMouseDown = false;
      const clickDuration = Date.now() - this.rightClickStartTime;
      const clickDistance = Math.sqrt(
        Math.pow(event.clientX - this.rightClickStartPosition.x, 2) +
          Math.pow(event.clientY - this.rightClickStartPosition.y, 2),
      );

      // If the click was short and the mouse didn't move much, show the context menu
      if (clickDuration < 200 && clickDistance < 5) {
        this.showContextMenuForHexagon(event);
      } else {
        this.hideContextMenu();
      }
    }
  }

  addEventListeners() {
    document.addEventListener("mousedown", this.onMouseDown.bind(this));
    document.addEventListener("mouseup", this.onMouseUp.bind(this));
    document.addEventListener("click", this.hideContextMenu.bind(this));

    window.addEventListener("click", this.onMouseClick.bind(this));
  }

  private centerCameraOnHex(hexCoords: { row: number; col: number }) {
    const worldPosition = this.hexGrid.getWorldPositionForHex(hexCoords);

    // Set the camera's target to the hexagon's position
    this.camera.position.set(
      worldPosition.x,
      this.camera.position.y, // Keep the current camera height
      worldPosition.z,
    );

    // Optionally, you can add a smooth transition here
    // using a library like Tween.js or implementing your own lerp function
  }

  private onMouseClick(event: MouseEvent) {
    // Update mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects: THREE.Intersection[] = [];
    this.loadedChunks.forEach((chunk) => {
      chunk.children.forEach((child) => {
        if (child instanceof THREE.InstancedMesh) {
          this.raycaster.intersectObject(child, false, intersects);
        }
      });
    });
  }

  private animateHaloPulse = () => {
    this.pulseAnimation = requestAnimationFrame(this.animateHaloPulse);

    if (this.haloMesh && this.haloMesh.visible) {
      this.pulseTime += 0.1;
      const pulseFactor = Math.sin(this.pulseTime) * 0.1 + 1.01; // Pulse between 1 and 1.2

      // Apply pulse to x and z scale, keeping y scale constant
      const currentScale = this.haloMesh.scale;
      this.haloMesh.scale.set(pulseFactor, currentScale.y, pulseFactor);

      // Optionally, you can also pulse the opacity
      (this.haloMesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(this.pulseTime) * 0.2 + 0.3; // Pulse opacity between 0.1 and 0.5
    }
  };

  stopPulseAnimation() {
    if (this.pulseAnimation !== null) {
      cancelAnimationFrame(this.pulseAnimation);
      this.pulseAnimation = null;
    }
  }

  private createHaloMesh(): THREE.Mesh {
    const haloGeometry = new THREE.CylinderGeometry(this.hexSize * 1.1, this.hexSize * 1.1, 0.1, 6);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.5,
    });
    const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
    haloMesh.rotation.x = Math.PI / 2; // Rotate to align with hexagon orientation
    return haloMesh;
  }

  private showHalo(instancedMesh: THREE.InstancedMesh, instanceId: number) {
    if (!this.haloMesh) {
      this.haloMesh = this.createHaloMesh();
      this.scene.add(this.haloMesh);
    }

    const matrix = new THREE.Matrix4();
    instancedMesh.getMatrixAt(instanceId, matrix);
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, rotation, scale);

    this.haloMesh.position.copy(position);
    this.haloMesh.position.y = scale.y / 2 + 0.05; // Place it at the top of the hexagon + a small offset
    // this.haloMesh.scale.set(1, 1, scale.y); // Scale the halo to match the hexagon height
    this.haloMesh.rotation.set(0, 0, 0); // Reset rotation
    this.haloMesh.visible = true;
  }

  private removeHalo() {
    if (this.haloMesh) {
      this.haloMesh.visible = false;
    }
  }

  checkHexagonHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects: THREE.Intersection[] = [];
    this.loadedChunks.forEach((chunk) => {
      chunk.children.forEach((child) => {
        if (child instanceof THREE.InstancedMesh) {
          this.raycaster.intersectObject(child, false, intersects);
        }
      });
    });

    if (intersects.length > 0) {
      const newHoveredHexagon = {
        instancedMesh: intersects[0].object as THREE.InstancedMesh,
        instanceId: intersects[0].instanceId!,
      };

      if (
        !this.hoveredHexagon ||
        this.hoveredHexagon.instancedMesh !== newHoveredHexagon.instancedMesh ||
        this.hoveredHexagon.instanceId !== newHoveredHexagon.instanceId
      ) {
        if (this.hoveredHexagon) {
          this.removeHalo();
        }
        this.hoveredHexagon = newHoveredHexagon;
        this.showHalo(intersects[0].object as THREE.InstancedMesh, intersects[0].instanceId!);
      }
    } else {
      if (this.hoveredHexagon) {
        this.removeHalo();
        this.hoveredHexagon = null;
      }
    }
  }
}
