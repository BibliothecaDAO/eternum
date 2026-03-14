import * as THREE from "three";
const HOVER_HEX_TEXTURE_SIZE = 96;
const HOVER_HEX_TEXTURE_RADIUS = 0.9;

export interface HoverHexMaterialUniforms {
  [uniform: string]: THREE.IUniform;
  uBaseColor: THREE.IUniform<THREE.Color>;
  accentColor: THREE.IUniform<THREE.Color>;
  intensity: THREE.IUniform<number>;
  time: THREE.IUniform<number>;
  scanSpeed: THREE.IUniform<number>;
  scanWidth: THREE.IUniform<number>;
  borderThickness: THREE.IUniform<number>;
  innerRingThickness: THREE.IUniform<number>;
  centerAlpha: THREE.IUniform<number>;
}

export interface HoverHexMaterialParameters {
  baseColor: THREE.ColorRepresentation;
  accentColor: THREE.ColorRepresentation;
  intensity: number;
  scanSpeed: number;
  scanWidth: number;
  borderThickness: number;
  innerRingThickness: number;
  centerAlpha: number;
}

export interface HoverHexMaterialController {
  material: THREE.MeshBasicMaterial;
  uniforms: HoverHexMaterialUniforms;
  setPalette: (baseColor: THREE.ColorRepresentation, accentColor: THREE.ColorRepresentation, intensity: number) => void;
  setTime: (time: number) => void;
  setParameters: (parameters: Partial<HoverHexMaterialParameters>) => void;
  dispose: () => void;
}

export const DEFAULT_HOVER_HEX_MATERIAL_PARAMETERS: HoverHexMaterialParameters = {
  baseColor: 0x3399ff,
  accentColor: 0x7ed7ff,
  intensity: 0.32,
  scanSpeed: 0.18,
  scanWidth: 0.14,
  borderThickness: 0.09,
  innerRingThickness: 0.04,
  centerAlpha: 0.12,
};

const scratchColor = new THREE.Color();
const scratchAccentColor = new THREE.Color();

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mix(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function hash21(x: number, y: number): number {
  const px = fract(x * 123.34);
  const py = fract(y * 456.21);
  const dot = px * (px + 45.32) + py * (py + 45.32);
  return fract((px + dot) * (py + dot));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sdHexagon(x: number, y: number, radius: number): number {
  const kx = -0.866025404;
  const ky = 0.5;
  const kz = 0.577350269;
  let px = Math.abs(x);
  let py = Math.abs(y);
  const dot = kx * px + ky * py;
  const minDot = Math.min(dot, 0);
  px -= 2 * minDot * kx;
  py -= 2 * minDot * ky;
  px -= clamp(px, -kz * radius, kz * radius);
  py -= radius;
  const magnitude = Math.sqrt(px * px + py * py);
  return magnitude * (py >= 0 ? 1 : -1);
}

function redrawHoverTexture(texture: THREE.DataTexture, uniforms: HoverHexMaterialUniforms): void {
  const data = texture.image.data as Uint8Array;
  const size = texture.image.width as number;
  const baseColor = scratchColor.copy(uniforms.uBaseColor.value);
  const accentColor = scratchAccentColor.copy(uniforms.accentColor.value);
  const intensity = uniforms.intensity.value;
  const time = uniforms.time.value;
  const scanSpeed = uniforms.scanSpeed.value;
  const scanWidth = uniforms.scanWidth.value;
  const borderThickness = uniforms.borderThickness.value;
  const innerRingThickness = uniforms.innerRingThickness.value;
  const centerAlpha = uniforms.centerAlpha.value;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const localX = (((x + 0.5) / size) - 0.5) * 2;
      const localY = (((y + 0.5) / size) - 0.5) * 2;
      const edgeDistance = sdHexagon(localX, localY, HOVER_HEX_TEXTURE_RADIUS);
      const normalizedDepth = clamp01((-edgeDistance) / HOVER_HEX_TEXTURE_RADIUS);
      const outerRim = smoothstep(borderThickness, 0, Math.abs(edgeDistance));
      const innerRing = smoothstep(
        innerRingThickness,
        0,
        Math.abs(edgeDistance + HOVER_HEX_TEXTURE_RADIUS * 0.22),
      );
      const scanPhase = fract(
        ((localX / HOVER_HEX_TEXTURE_RADIUS) * 0.42) +
          ((localY / HOVER_HEX_TEXTURE_RADIUS) * 0.58) -
          (time * scanSpeed),
      );
      const scanBand = smoothstep(scanWidth, 0, Math.abs(scanPhase - 0.5));
      const scanMask = scanBand * smoothstep(0.12, 0.82, normalizedDepth);
      const breakup = mix(0.72, 1, hash21(Math.floor(localX * 5), Math.floor(localY * 5)));
      const centerMask = smoothstep(0.2, 0.78, normalizedDepth);
      const interior = centerAlpha * centerMask * breakup;
      const alpha = clamp01(interior + outerRim * 0.92 + innerRing * 0.4 + scanMask * 0.48) * intensity;
      const accentMix = clamp01(outerRim * 0.78 + innerRing * 0.32 + scanMask * 0.6);
      const pixelColor = scratchColor.copy(baseColor).lerp(accentColor, accentMix).convertLinearToSRGB();

      data[index] = Math.round(clamp01(pixelColor.r) * 255);
      data[index + 1] = Math.round(clamp01(pixelColor.g) * 255);
      data[index + 2] = Math.round(clamp01(pixelColor.b) * 255);
      data[index + 3] = Math.round(alpha * 255);
    }
  }

  texture.needsUpdate = true;
}

export function createHoverHexMaterial(
  parameters: Partial<HoverHexMaterialParameters> = {},
): HoverHexMaterialController {
  const resolved = {
    ...DEFAULT_HOVER_HEX_MATERIAL_PARAMETERS,
    ...parameters,
  };

  const uniforms: HoverHexMaterialUniforms = {
    uBaseColor: { value: new THREE.Color(resolved.baseColor) },
    accentColor: { value: new THREE.Color(resolved.accentColor) },
    intensity: { value: resolved.intensity },
    time: { value: 0 },
    scanSpeed: { value: resolved.scanSpeed },
    scanWidth: { value: resolved.scanWidth },
    borderThickness: { value: resolved.borderThickness },
    innerRingThickness: { value: resolved.innerRingThickness },
    centerAlpha: { value: resolved.centerAlpha },
  };

  const textureData = new Uint8Array(HOVER_HEX_TEXTURE_SIZE * HOVER_HEX_TEXTURE_SIZE * 4);
  const texture = new THREE.DataTexture(textureData, HOVER_HEX_TEXTURE_SIZE, HOVER_HEX_TEXTURE_SIZE, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
  });
  material.toneMapped = false;
  redrawHoverTexture(texture, uniforms);

  return {
    material,
    uniforms,
    setPalette(baseColor, accentColor, intensity) {
      uniforms.uBaseColor.value.set(baseColor);
      uniforms.accentColor.value.set(accentColor);
      uniforms.intensity.value = intensity;
      redrawHoverTexture(texture, uniforms);
    },
    setTime(time) {
      uniforms.time.value = time;
      redrawHoverTexture(texture, uniforms);
    },
    setParameters(nextParameters) {
      if (nextParameters.baseColor !== undefined) {
        uniforms.uBaseColor.value.set(nextParameters.baseColor);
      }

      if (nextParameters.accentColor !== undefined) {
        uniforms.accentColor.value.set(nextParameters.accentColor);
      }

      if (nextParameters.intensity !== undefined) {
        uniforms.intensity.value = nextParameters.intensity;
      }

      if (nextParameters.scanSpeed !== undefined) {
        uniforms.scanSpeed.value = nextParameters.scanSpeed;
      }

      if (nextParameters.scanWidth !== undefined) {
        uniforms.scanWidth.value = nextParameters.scanWidth;
      }

      if (nextParameters.borderThickness !== undefined) {
        uniforms.borderThickness.value = nextParameters.borderThickness;
      }

      if (nextParameters.innerRingThickness !== undefined) {
        uniforms.innerRingThickness.value = nextParameters.innerRingThickness;
      }

      if (nextParameters.centerAlpha !== undefined) {
        uniforms.centerAlpha.value = nextParameters.centerAlpha;
      }

      redrawHoverTexture(texture, uniforms);
    },
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}
