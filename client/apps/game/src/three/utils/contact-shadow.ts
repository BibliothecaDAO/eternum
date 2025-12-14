import { CanvasTexture, LinearFilter, MeshBasicMaterial, PlaneGeometry } from "three";

export interface ContactShadowResources {
  geometry: PlaneGeometry;
  material: MeshBasicMaterial;
}

let cachedResources: ContactShadowResources | null = null;

function createContactShadowTexture(size: number): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const center = size * 0.5;
  const radius = size * 0.5;

  ctx.clearRect(0, 0, size, size);

  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0.0, "rgba(255,255,255,1.0)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1.0, "rgba(255,255,255,0.0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function getContactShadowResources(): ContactShadowResources {
  if (cachedResources) {
    return cachedResources;
  }

  const texture = createContactShadowTexture(128);
  const geometry = new PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new MeshBasicMaterial({
    map: texture ?? undefined,
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    toneMapped: false,
  });

  // Reduce z-fighting with the terrain without relying purely on y-offset.
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;

  cachedResources = { geometry, material };
  return cachedResources;
}
