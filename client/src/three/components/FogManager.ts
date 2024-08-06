import * as THREE from "three";
import { Scene, Raycaster } from "three";

export class FogManager {
  private fog: THREE.Fog;
  private fogRadius: number = 30; // Adjust this value to change the size of the clear area

  constructor(
    private scene: Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    const fogColor = new THREE.Color(0xcccccc); // Light gray fog
    this.fog = new THREE.Fog(fogColor, 0.1, this.fogRadius);
    //this.scene.fog = this.fog;
  }

  updateFog() {
    const cameraPosition = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);

    // Set fog start and end distances relative to camera position
    this.fog.near = this.fogRadius * 0.8; // Start fog slightly before the edge of visible area
    this.fog.far = this.fogRadius;

    // Update fog color based on distance from center (optional)
    const distanceFromCenter = Math.sqrt(cameraPosition.x * cameraPosition.x + cameraPosition.z * cameraPosition.z);
    const fogIntensity = Math.min(distanceFromCenter / (this.fogRadius * 2), 1);
    const fogColor = new THREE.Color(0xcccccc).lerp(new THREE.Color(0x666666), fogIntensity);
    this.fog.color.copy(fogColor);
    //this.scene.background = fogColor;
  }
}
