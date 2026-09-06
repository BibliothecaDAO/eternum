import { DataTexture, LinearFilter, MeshBasicMaterial, PlaneGeometry } from "three";

interface ContactShadowResources {
  geometry: PlaneGeometry;
  material: MeshBasicMaterial;
}

let cachedResources: ContactShadowResources | null = null;

function createContactShadowTexture(size: number): DataTexture {
  // A CPU mask avoids WebGPU's first canvas-copy pipeline stall during game entry.
  const pixels = new Uint8Array(size * size * 4);
  const radius = size / 2;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const distance = Math.hypot(col + 0.5 - radius, row + 0.5 - radius) / radius;
      const alpha = distance < 0.35 ? 1 - (distance / 0.35) * 0.65 : ((1 - distance) / 0.65) * 0.35;
      const offset = (row * size + col) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(Math.max(0, alpha) * 255);
    }
  }
  const texture = new DataTexture(pixels, size, size);
  texture.name = "contact-shadow";
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
    map: texture,
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

export function disposeContactShadowResources(): void {
  if (!cachedResources) {
    return;
  }

  cachedResources.geometry.dispose();
  cachedResources.material.map?.dispose();
  cachedResources.material.dispose();
  cachedResources = null;
}
