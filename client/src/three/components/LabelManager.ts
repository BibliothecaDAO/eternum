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
    label.userData.isLabel = true;
    return label;
  }
}
