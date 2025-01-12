import * as THREE from "three";

export class LabelManager {
  private labelTexture: THREE.Texture;
  private labelMaterial: THREE.PointsMaterial;

  constructor(texturePath: string, size: number = 2) {
    this.labelTexture = new THREE.TextureLoader().load(texturePath, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
    });

    this.labelMaterial = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      map: this.labelTexture,
      alphaTest: 0.001,
      depthTest: false,
      toneMapped: true,
    });
  }

  createLabel(position: THREE.Vector3, color: THREE.Color): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([position.x, position.y + 1.5, position.z]);
    const colors = new Float32Array([color.r, color.g, color.b]);

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const label = new THREE.Points(geometry, this.labelMaterial);
    label.renderOrder = 2;
    label.userData.isLabel = true;

    // Disable raycasting for this label
    label.raycast = () => {};

    return label;
  }

  updateLabelPosition(label: THREE.Points, newPosition: THREE.Vector3): void {
    if (label.userData.isLabel) {
      const positions = label.geometry.attributes.position;
      positions.setXYZ(0, newPosition.x, newPosition.y + 1.5, newPosition.z);
      positions.needsUpdate = true;
    } else {
      console.warn("Attempted to update position of a non-label object");
    }
  }

  removeLabel(label: THREE.Points, scene: THREE.Scene) {
    if (!(label instanceof THREE.Points)) return false;

    scene.remove(label);
    if (label.geometry) {
      label.geometry.dispose();
    }

    if (label.material) {
      if (label.material instanceof Array) {
        label.material.forEach((material) => {
          material.dispose();
        });
      } else {
        label.material.dispose();
      }
    }

    return true;
  }
}
