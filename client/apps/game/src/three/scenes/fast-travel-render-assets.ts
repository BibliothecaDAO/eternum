import {
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
} from "three";

import type { FastTravelSurfacePalette } from "./fast-travel-surface-material";

const FAST_TRAVEL_HEX_SIZE = 1;

export interface FastTravelRenderAssets {
  hexEdgeGeometry: EdgesGeometry;
  hexEdgeMaterial: LineBasicMaterial;
  armyGeometry: SphereGeometry;
  armyMaterial: MeshStandardMaterial;
  spireColumnGeometry: CylinderGeometry;
  spireColumnMaterial: MeshStandardMaterial;
  spireCrownGeometry: ConeGeometry;
  spireCrownMaterial: MeshStandardMaterial;
  syncPalette(palette: FastTravelSurfacePalette): void;
  createHexEdgeMesh(): LineSegments;
  createArmyMarkerMesh(): Mesh;
  createSpireColumnMesh(): Mesh;
  createSpireCrownMesh(): Mesh;
  dispose(): void;
}

function createFastTravelHexShape(radius: number): Shape {
  const shape = new Shape();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

export function createFastTravelRenderAssets(): FastTravelRenderAssets {
  const hexShape = createFastTravelHexShape(FAST_TRAVEL_HEX_SIZE * 0.96);
  const tempFillGeometry = new ShapeGeometry(hexShape);
  const hexEdgeGeometry = new EdgesGeometry(tempFillGeometry);
  tempFillGeometry.dispose();

  const hexEdgeMaterial = new LineBasicMaterial({
    color: "#ff4fd8",
    opacity: 0.92,
    transparent: true,
  });
  const armyGeometry = new SphereGeometry(0.35, 18, 18);
  const armyMaterial = new MeshStandardMaterial({
    color: "#ffd6f7",
    emissive: "#ff92ea",
    emissiveIntensity: 0.8,
  });
  const spireColumnGeometry = new CylinderGeometry(0.18, 0.28, 1.6, 6);
  const spireColumnMaterial = new MeshStandardMaterial({
    color: "#ff4fd8",
    emissive: "#ff92ea",
    emissiveIntensity: 1.2,
  });
  const spireCrownGeometry = new ConeGeometry(0.42, 0.8, 6);
  const spireCrownMaterial = new MeshStandardMaterial({
    color: "#ffd6f7",
    emissive: "#ffd6f7",
    emissiveIntensity: 1.3,
  });

  return {
    hexEdgeGeometry,
    hexEdgeMaterial,
    armyGeometry,
    armyMaterial,
    spireColumnGeometry,
    spireColumnMaterial,
    spireCrownGeometry,
    spireCrownMaterial,
    syncPalette(palette) {
      hexEdgeMaterial.color.set(palette.edgeColor);
      hexEdgeMaterial.opacity = palette.edgeOpacity;
      hexEdgeMaterial.needsUpdate = true;

      armyMaterial.color.set(palette.accentColor);
      armyMaterial.emissive.set(palette.glowColor);
      armyMaterial.needsUpdate = true;

      spireColumnMaterial.color.set(palette.edgeColor);
      spireColumnMaterial.emissive.set(palette.glowColor);
      spireColumnMaterial.needsUpdate = true;

      spireCrownMaterial.color.set(palette.accentColor);
      spireCrownMaterial.emissive.set(palette.accentColor);
      spireCrownMaterial.needsUpdate = true;
    },
    createHexEdgeMesh() {
      const mesh = new LineSegments(hexEdgeGeometry, hexEdgeMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.03;
      mesh.renderOrder = 3;
      return mesh;
    },
    createArmyMarkerMesh() {
      return new Mesh(armyGeometry, armyMaterial);
    },
    createSpireColumnMesh() {
      return new Mesh(spireColumnGeometry, spireColumnMaterial);
    },
    createSpireCrownMesh() {
      return new Mesh(spireCrownGeometry, spireCrownMaterial);
    },
    dispose() {
      hexEdgeGeometry.dispose();
      hexEdgeMaterial.dispose();
      armyGeometry.dispose();
      armyMaterial.dispose();
      spireColumnGeometry.dispose();
      spireColumnMaterial.dispose();
      spireCrownGeometry.dispose();
      spireCrownMaterial.dispose();
    },
  };
}
