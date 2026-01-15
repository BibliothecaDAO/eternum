import { ShaderMaterial, Texture } from "three";

/**
 * Vertex shader for billboard points with configurable size attenuation
 * When sizeAttenuation is false, points maintain constant pixel size regardless of distance
 * When sizeAttenuation is true, points scale with distance like regular PointsMaterial
 */
const vertexShader = `
uniform float pointSize;
uniform float hoverScale;
uniform float sizeAttenuation;

attribute float size;
attribute float colorIndex;
attribute float hover;

varying float vColorIndex;
varying float vHover;

#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
  vColorIndex = colorIndex;
  vHover = hover;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  // Calculate base size with hover effect
  float finalSize = pointSize * size * (1.0 + hover * (hoverScale - 1.0));

  // Apply distance-based scaling if sizeAttenuation is enabled
  if (sizeAttenuation > 0.5) {
    // Scale with distance (like PointsMaterial with sizeAttenuation: true)
    gl_PointSize = finalSize * (300.0 / -mvPosition.z);
  } else {
    // Fixed screen size (like PointsMaterial with sizeAttenuation: false)
    gl_PointSize = finalSize;
  }

  gl_Position = projectionMatrix * mvPosition;

  #include <logdepthbuf_vertex>
}
`;

/**
 * Fragment shader for sprite texture rendering with color tinting
 */
const fragmentShader = `
uniform sampler2D spriteTexture;
uniform vec3 baseColor;
uniform float hoverBrightness;

varying float vColorIndex;
varying float vHover;

#include <common>
#include <logdepthbuf_pars_fragment>

void main() {
  #include <logdepthbuf_fragment>

  // Use point coordinates directly (no flip)
  vec2 uv = gl_PointCoord;

  // Sample sprite texture
  vec4 texColor = texture2D(spriteTexture, uv);

  // Discard transparent pixels for clean edges
  if (texColor.a < 0.1) discard;

  // Apply base color tint
  vec3 finalColor = texColor.rgb * baseColor;

  // Apply hover brightness boost
  finalColor = mix(finalColor, finalColor * hoverBrightness, vHover);

  // Use full opacity to avoid half-transparency
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

/**
 * Creates a shader material for points-based labels
 * @param spriteTexture - Texture containing the icon sprite
 * @param pointSize - Base size of points in pixels (default: 32)
 * @param hoverScale - Scale multiplier on hover (default: 1.2)
 * @param hoverBrightness - Brightness multiplier on hover (default: 1.3)
 * @param sizeAttenuation - If false, points stay fixed screen size; if true, they scale with distance (default: false)
 */
export function createPointsLabelMaterial(
  spriteTexture: Texture,
  pointSize = 32,
  hoverScale = 1.2,
  hoverBrightness = 1.3,
  sizeAttenuation = false,
): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      spriteTexture: { value: spriteTexture },
      baseColor: { value: [1.0, 1.0, 1.0] }, // White (no tint)
      pointSize: { value: pointSize },
      hoverScale: { value: hoverScale },
      hoverBrightness: { value: hoverBrightness },
      sizeAttenuation: { value: sizeAttenuation ? 1.0 : 0.0 },
    },
    transparent: true,
    depthTest: false, // Disable depth test to always render on top
    depthWrite: false, // Disable depth writing when rendering on top
  });
}
