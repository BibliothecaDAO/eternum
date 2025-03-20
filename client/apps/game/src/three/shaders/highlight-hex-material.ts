import { Color, ShaderMaterial } from "three";

const vertexShader = `
varying vec3 vPosition;

#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const fragmentShader = `
uniform vec3 color;
uniform float opacity;
uniform float time;
varying vec3 vPosition;

#include <common>
#include <logdepthbuf_pars_fragment>

void main() {
  #include <logdepthbuf_fragment>
  float edgeDistance = length(vPosition.xy) * 0.35;
  float gradient = smoothstep(0.5, 0.0, edgeDistance);
  
  // Create a pulsing effect using sin function
  float pulseSpeed = 3.0;
  float pulseIntensity = sin(time * pulseSpeed) * 0.5 + 0.5;
  float finalOpacity = mix(0.35, opacity * 2.0, gradient) * pulseIntensity;
  
  // Add slight color pulsing
  vec3 finalColor = color * (0.8 + pulseIntensity * 0.4);
  
  gl_FragColor = vec4(finalColor, finalOpacity);
}
`;

const greenColor = new Color("darkgreen");
greenColor.multiplyScalar(12);

export const highlightHexMaterial = new ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    color: { value: greenColor },
    opacity: { value: 0.25 },
    time: { value: 0 },
  },
  transparent: true,
});
