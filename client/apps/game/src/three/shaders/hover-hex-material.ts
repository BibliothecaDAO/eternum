import { Color, ShaderMaterial } from "three";

const vertexShader = `
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const fragmentShader = `
uniform vec3 color;
uniform float opacity;
uniform float time;
uniform float rimStrength;
uniform vec3 rimColor;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

#include <common>
#include <logdepthbuf_pars_fragment>

void main() {
  #include <logdepthbuf_fragment>
  
  // Distance from center for radial gradient
  float distanceFromCenter = length(vPosition.xy);
  
  // Rim lighting effect based on normal
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float rimFactor = 1.0 - max(0.0, dot(vNormal, viewDirection));
  rimFactor = pow(rimFactor, 2.0);
  
  // Create pulsing effect
  float pulse = 0.8 + 0.2 * sin(time * 3.0);
  
  // Combine rim lighting with subtle radial gradient
  float edgeGradient = smoothstep(0.6, 0.0, distanceFromCenter * 0.6);
  float finalRimStrength = rimFactor * rimStrength * pulse;
  
  // Mix the base color with rim color
  vec3 finalColor = mix(color, rimColor, finalRimStrength * 0.4);
  
  // Calculate final opacity with both rim and edge effects
  float combinedAlpha = max(finalRimStrength, edgeGradient * 0.3) * opacity;
  
  gl_FragColor = vec4(finalColor, combinedAlpha);
}
`;

// Create a subtle blue-white rim color
const rimColor = new Color(0.4, 0.8, 1.0); // Soft blue
rimColor.multiplyScalar(2.0); // Increase intensity

const baseColor = new Color(0.2, 0.6, 1.0); // Base blue color

export const hoverHexMaterial = new ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    color: { value: baseColor },
    rimColor: { value: rimColor },
    opacity: { value: 0.6 },
    time: { value: 0 },
    rimStrength: { value: 1.0 },
  },
  transparent: true,
  depthWrite: false,
  blending: 1, // NormalBlending instead of AdditiveBlending
});

// Frame limiting for shader animation
let lastShaderUpdate = 0;
const SHADER_UPDATE_INTERVAL = 1000 / 30; // 30 FPS max for shader animation

/**
 * Update the hover hex material animation with frame limiting
 */
export function updateHoverHexMaterial(deltaTime: number) {
  const now = performance.now();
  if (now - lastShaderUpdate >= SHADER_UPDATE_INTERVAL) {
    hoverHexMaterial.uniforms.time.value += deltaTime;
    lastShaderUpdate = now;
  }
}