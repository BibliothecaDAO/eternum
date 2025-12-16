import { Color, ShaderMaterial, Vector2 } from "three";
import { DEFAULT_PATH_CONFIG } from "../types/path";

/**
 * Vertex shader for path line rendering.
 *
 * Takes instance attributes (start/end positions) and expands
 * a quad ribbon with screen-space constant thickness.
 */
const vertexShader = /* glsl */ `
// Note: 'uv' is automatically provided by Three.js

// Instance attributes (per-segment)
attribute vec3 instanceStart;
attribute vec3 instanceEnd;
attribute float instanceLength;
attribute float instancePathProgress;
attribute vec3 instanceColor;
attribute float instanceOpacity;

// Uniforms
uniform float thickness;
uniform vec2 resolution;
uniform float time;
uniform float totalPathLength;

// Varyings to fragment
varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;
varying float vSegmentProgress;
varying float vLocalProgress;

#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
    // Interpolate position along segment based on UV.y
    // UV.y = 0 at segment start, 1 at segment end
    vec3 worldPos = mix(instanceStart, instanceEnd, uv.y);

    // Project start and end to clip space
    vec4 clipStart = projectionMatrix * modelViewMatrix * vec4(instanceStart, 1.0);
    vec4 clipEnd = projectionMatrix * modelViewMatrix * vec4(instanceEnd, 1.0);

    // Convert to NDC for direction calculation
    vec2 ndcStart = clipStart.xy / clipStart.w;
    vec2 ndcEnd = clipEnd.xy / clipEnd.w;

    // Direction in screen space
    vec2 screenDir = ndcEnd - ndcStart;

    // Handle degenerate case (zero-length segment)
    float dirLen = length(screenDir);
    if (dirLen < 0.0001) {
        screenDir = vec2(1.0, 0.0);
    } else {
        screenDir = screenDir / dirLen;
    }

    // Perpendicular direction for thickness
    vec2 screenNormal = vec2(-screenDir.y, screenDir.x);

    // Project current position
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);

    // Calculate screen-space offset
    // UV.x: 0 = left edge, 1 = right edge
    float side = uv.x * 2.0 - 1.0; // -1 to +1

    // Thickness in clip space (screen-space constant)
    // Multiply by aspect ratio correction for non-square viewports
    vec2 offset = screenNormal * side * thickness / resolution.y;

    // Apply offset (multiply by w to convert from NDC back to clip space)
    clipPos.xy += offset * clipPos.w;

    gl_Position = clipPos;

    // Pass to fragment shader
    vUv = uv;
    vColor = instanceColor;
    vOpacity = instanceOpacity;
    vSegmentProgress = instancePathProgress;
    vLocalProgress = uv.y;

    #include <logdepthbuf_vertex>
}
`;

/**
 * Fragment shader for path line rendering.
 *
 * Phase 1: Simple solid color with soft edges
 * Phase 2 will add: dashed lines, flow animation, progress highlight
 */
const fragmentShader = /* glsl */ `
uniform float time;
uniform float dashScale;
uniform float flowSpeed;
uniform float armyProgress;

varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;
varying float vSegmentProgress;
varying float vLocalProgress;

#include <common>
#include <logdepthbuf_pars_fragment>

void main() {
    #include <logdepthbuf_fragment>

    // Skip if fully transparent
    if (vOpacity < 0.001) discard;

    // === SOFT EDGES (anti-aliasing) ===
    // vUv.x is 0 at left edge, 1 at right edge
    float distFromCenter = abs(vUv.x - 0.5) * 2.0; // 0 at center, 1 at edge
    float edgeAA = 1.0 - smoothstep(0.6, 1.0, distFromCenter);

    // === DASHED LINE (Phase 2 feature, enabled) ===
    float dashPhase = (vSegmentProgress + vLocalProgress * 0.1) * dashScale - time * flowSpeed;
    float dash = smoothstep(0.3, 0.5, fract(dashPhase));

    // === ENDPOINT FADE ===
    // Fade at the very start and end of the full path
    float endFade = smoothstep(0.0, 0.03, vSegmentProgress + vLocalProgress * 0.01);
    endFade *= smoothstep(1.0, 0.97, vSegmentProgress + vLocalProgress * 0.01);

    // === PROGRESS HIGHLIGHT (subtle brightening near army) ===
    float currentProgress = vSegmentProgress + vLocalProgress * 0.1;
    float progressDist = abs(currentProgress - armyProgress);
    float progressHighlight = 1.0 + 0.3 * (1.0 - smoothstep(0.0, 0.08, progressDist));

    // === COMBINE ===
    vec3 finalColor = vColor * progressHighlight;
    float finalAlpha = vOpacity * edgeAA * dash * endFade;

    // Discard nearly transparent fragments
    if (finalAlpha < 0.01) discard;

    gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

/**
 * Default uniforms for path line material
 */
function createDefaultUniforms() {
  return {
    time: { value: 0 },
    thickness: { value: DEFAULT_PATH_CONFIG.thickness },
    resolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
    dashScale: { value: DEFAULT_PATH_CONFIG.dashScale },
    flowSpeed: { value: DEFAULT_PATH_CONFIG.flowSpeed },
    armyProgress: { value: 0 },
    totalPathLength: { value: 1 },
  };
}

/**
 * Create the path line shader material
 */
export function createPathLineMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: createDefaultUniforms(),
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: 1, // NormalBlending
  });
}

/**
 * Shared material instance for all paths (singleton pattern)
 */
let sharedMaterial: ShaderMaterial | null = null;

export function getPathLineMaterial(): ShaderMaterial {
  if (!sharedMaterial) {
    sharedMaterial = createPathLineMaterial();
  }
  return sharedMaterial;
}

/**
 * Update time uniform for animation
 */
export function updatePathLineMaterial(deltaTime: number): void {
  if (sharedMaterial) {
    sharedMaterial.uniforms.time.value += deltaTime;
  }
}

/**
 * Update resolution uniform (call on window resize)
 */
export function updatePathLineResolution(width: number, height: number): void {
  if (sharedMaterial) {
    sharedMaterial.uniforms.resolution.value.set(width, height);
  }
}

/**
 * Update army progress uniform (for highlighting current position)
 */
export function updatePathLineProgress(progress: number): void {
  if (sharedMaterial) {
    sharedMaterial.uniforms.armyProgress.value = progress;
  }
}

/**
 * Set line thickness
 */
export function setPathLineThickness(thickness: number): void {
  if (sharedMaterial) {
    sharedMaterial.uniforms.thickness.value = thickness;
  }
}

/**
 * Dispose of shared material
 */
export function disposePathLineMaterial(): void {
  if (sharedMaterial) {
    sharedMaterial.dispose();
    sharedMaterial = null;
  }
}

/**
 * Get default path color based on owner type
 */
export function getPathColor(ownerType: "self" | "ally" | "enemy"): Color {
  switch (ownerType) {
    case "self":
      return new Color(0.2, 0.8, 1.0); // Bright cyan/blue
    case "ally":
      return new Color(0.2, 0.9, 0.4); // Green
    case "enemy":
      return new Color(1.0, 0.3, 0.3); // Red
    default:
      return new Color(0.7, 0.7, 0.7); // Gray
  }
}
