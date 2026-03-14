import { HEX_SIZE } from "@/three/constants";
import * as THREE from "three";

const HOVER_HEX_RADIUS = HEX_SIZE * 1.02;

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
  material: THREE.ShaderMaterial;
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

const vertexShader = `
  varying vec2 vHexPosition;

  void main() {
    vHexPosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vHexPosition;

  uniform vec3 uBaseColor;
  uniform vec3 accentColor;
  uniform float intensity;
  uniform float time;
  uniform float scanSpeed;
  uniform float scanWidth;
  uniform float borderThickness;
  uniform float innerRingThickness;
  uniform float centerAlpha;

  const float HEX_RADIUS = ${HOVER_HEX_RADIUS.toFixed(6)};

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float sdHexagon(vec2 point, float radius) {
    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
    point = abs(point);
    point -= 2.0 * min(dot(k.xy, point), 0.0) * k.xy;
    point -= vec2(clamp(point.x, -k.z * radius, k.z * radius), radius);
    return length(point) * sign(point.y);
  }

  void main() {
    float edgeDistance = sdHexagon(vHexPosition, HEX_RADIUS);
    float normalizedDepth = clamp((-edgeDistance) / HEX_RADIUS, 0.0, 1.0);
    float outerRim = smoothstep(borderThickness, 0.0, abs(edgeDistance));
    float innerRing = smoothstep(innerRingThickness, 0.0, abs(edgeDistance + HEX_RADIUS * 0.22));

    float scanPhase = fract(
      ((vHexPosition.x / HEX_RADIUS) * 0.42) +
      ((vHexPosition.y / HEX_RADIUS) * 0.58) -
      (time * scanSpeed)
    );
    float scanBand = smoothstep(scanWidth, 0.0, abs(scanPhase - 0.5));
    float scanMask = scanBand * smoothstep(0.12, 0.82, normalizedDepth);

    float breakup = mix(0.72, 1.0, hash21(floor(vHexPosition * 5.0)));
    float centerMask = smoothstep(0.2, 0.78, normalizedDepth);
    float interior = centerAlpha * centerMask * breakup;

    float alpha = clamp(interior + outerRim * 0.92 + innerRing * 0.4 + scanMask * 0.48, 0.0, 1.0) * intensity;
    float accentMix = clamp(outerRim * 0.78 + innerRing * 0.32 + scanMask * 0.6, 0.0, 1.0);
    vec3 color = mix(uBaseColor, accentColor, accentMix);

    gl_FragColor = vec4(color, alpha);
  }
`;

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

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
  material.toneMapped = false;

  return {
    material,
    uniforms,
    setPalette(baseColor, accentColor, intensity) {
      uniforms.uBaseColor.value.set(baseColor);
      uniforms.accentColor.value.set(accentColor);
      uniforms.intensity.value = intensity;
    },
    setTime(time) {
      uniforms.time.value = time;
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
    },
    dispose() {
      material.dispose();
    },
  };
}
