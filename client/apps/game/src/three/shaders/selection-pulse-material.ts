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

export function createSelectionPulseMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      color: { value: new Color(0.2, 0.8, 1.0) },
      pulseColor: { value: new Color(1.0, 1.0, 0.8) },
      opacity: { value: 0.5 },
      time: { value: 0 },
      pulseStrength: { value: 0.75 },
      speed: { value: 2.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: 1,
  });
}

/**
 * Update the selection pulse material animation
 */
export function updateSelectionPulseMaterial(material: ShaderMaterial, deltaTime: number) {
  material.uniforms.time.value += deltaTime;
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
function setSelectionColorForPlayer(
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
function setSelectionColorFromProfile(material: ShaderMaterial, profile: PlayerColorProfile): void {
  material.uniforms.color.value.copy(profile.selection);
  // Use a brighter version of the primary color for the pulse
  const pulseCol = profile.primary.clone();
  pulseCol.offsetHSL(0, -0.1, 0.2); // Make it slightly lighter and less saturated
  material.uniforms.pulseColor.value.copy(pulseCol);
}

/**
 * Reset selection colors to default (bright blue)
 */
function resetSelectionColors(material: ShaderMaterial): void {
  material.uniforms.color.value.setRGB(0.2, 0.8, 1.0);
  material.uniforms.pulseColor.value.setRGB(1.0, 1.0, 0.8);
}

/**
 * Get current selection colors for debugging
 */
function getSelectionColors(material: ShaderMaterial): { baseColor: Color; pulseColor: Color } {
  return {
    baseColor: material.uniforms.color.value.clone(),
    pulseColor: material.uniforms.pulseColor.value.clone(),
  };
}
