import { Color, ShaderMaterial } from "three";
import { playerColorManager, PlayerColorProfile } from "../systems/player-colors";

const vertexShader = `
varying vec3 vPosition;
varying vec3 vWorldPosition;

#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
  vPosition = position;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const fragmentShader = `
uniform vec3 color;
uniform vec3 pulseColor;
uniform float opacity;
uniform float time;
uniform float pulseStrength;
uniform float speed;
varying vec3 vPosition;
varying vec3 vWorldPosition;

#include <common>
#include <logdepthbuf_pars_fragment>

void main() {
  #include <logdepthbuf_fragment>
  
  // Distance from center for radial effects
  float distanceFromCenter = length(vPosition.xy);
  
  // Create breathing/pulsing effect using sine wave
  float pulse = 0.5 + 0.5 * sin(time * speed * 2.0);
  
  // Create expanding rings effect
  float ring1 = sin(distanceFromCenter * 8.0 - time * speed * 4.0) * 0.5 + 0.5;
  float ring2 = sin(distanceFromCenter * 12.0 - time * speed * 3.0) * 0.3 + 0.3;
  
  // Combine pulsing and rings
  float combinedPulse = pulse * pulseStrength;
  float combinedRings = (ring1 + ring2) * 0.3;
  
  // Fade out towards edges
  float edgeFade = 1.0 - smoothstep(0.5, 1.0, distanceFromCenter);
  
  // Mix colors based on pulse intensity
  vec3 finalColor = mix(color, pulseColor, combinedPulse * 0.6);
  
  // Calculate final opacity with pulsing and edge fade
  float finalOpacity = (combinedPulse + combinedRings) * edgeFade * opacity;
  
  gl_FragColor = vec4(finalColor, finalOpacity);
}
`;

// Create selection-appropriate colors
const baseColor = new Color(0.2, 0.8, 1.0); // Bright blue
const pulseColor = new Color(1.0, 1.0, 0.8); // Warm white/yellow

export const selectionPulseMaterial = new ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    color: { value: baseColor },
    pulseColor: { value: pulseColor },
    opacity: { value: 0.5 }, // Half the opacity
    time: { value: 0 },
    pulseStrength: { value: 0.75 }, // Half the pulse strength
    speed: { value: 2.0 }, // Keep the faster animation
  },
  transparent: true,
  depthWrite: false,
  blending: 1, // NormalBlending
});

/**
 * Update the selection pulse material animation
 */
export function updateSelectionPulseMaterial(deltaTime: number) {
  selectionPulseMaterial.uniforms.time.value += deltaTime;
}

/**
 * Set player-specific selection colors based on ownership
 * This allows the selection ring to reflect the owner's color for visual consistency
 *
 * @param isMine - Is this the current player's unit?
 * @param isAlly - Is this an ally's unit?
 * @param isDaydreamsAgent - Is this an AI agent?
 * @param ownerAddress - Owner's wallet address for enemy color assignment
 */
export function setSelectionColorForPlayer(
  isMine: boolean,
  isAlly: boolean,
  isDaydreamsAgent: boolean,
  ownerAddress?: bigint | string,
): void {
  const profile = playerColorManager.getProfileForUnit(isMine, isAlly, isDaydreamsAgent, ownerAddress);
  setSelectionColorFromProfile(profile);
}

/**
 * Set selection colors directly from a PlayerColorProfile
 */
export function setSelectionColorFromProfile(profile: PlayerColorProfile): void {
  selectionPulseMaterial.uniforms.color.value.copy(profile.selection);
  // Use a brighter version of the primary color for the pulse
  const pulseCol = profile.primary.clone();
  pulseCol.offsetHSL(0, -0.1, 0.2); // Make it slightly lighter and less saturated
  selectionPulseMaterial.uniforms.pulseColor.value.copy(pulseCol);
}

/**
 * Reset selection colors to default (bright blue)
 */
export function resetSelectionColors(): void {
  selectionPulseMaterial.uniforms.color.value.setRGB(0.2, 0.8, 1.0);
  selectionPulseMaterial.uniforms.pulseColor.value.setRGB(1.0, 1.0, 0.8);
}

/**
 * Get current selection colors for debugging
 */
export function getSelectionColors(): { baseColor: Color; pulseColor: Color } {
  return {
    baseColor: selectionPulseMaterial.uniforms.color.value.clone(),
    pulseColor: selectionPulseMaterial.uniforms.pulseColor.value.clone(),
  };
}
