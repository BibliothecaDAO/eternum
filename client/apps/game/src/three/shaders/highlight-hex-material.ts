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
varying vec3 vPosition;

#include <common>
#include <logdepthbuf_pars_fragment>

void main() {
  #include <logdepthbuf_fragment>
  float edgeDistance = length(vPosition.xy) * 0.35;
  float gradient = smoothstep(0.5, 0.0, edgeDistance);
  float finalOpacity = mix(0.35, opacity, gradient);

  gl_FragColor = vec4(color, finalOpacity);
}
`;

// Instanced version of the vertex shader - passes instance color to fragment
const instancedVertexShader = `
varying vec3 vPosition;
varying vec3 vInstanceColor;

#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
  vPosition = position;
  vInstanceColor = instanceColor;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

// Instanced version of the fragment shader - uses instance color
const instancedFragmentShader = `
uniform float opacity;
varying vec3 vPosition;
varying vec3 vInstanceColor;

#include <common>
#include <logdepthbuf_pars_fragment>

void main() {
  #include <logdepthbuf_fragment>
  float edgeDistance = length(vPosition.xy) * 0.35;
  float gradient = smoothstep(0.5, 0.0, edgeDistance);
  float finalOpacity = mix(0.35, opacity, gradient);

  gl_FragColor = vec4(vInstanceColor, finalOpacity);
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
  },
  transparent: true,
});

// Instanced material for use with InstancedMesh - supports per-instance colors
export const highlightHexInstancedMaterial = new ShaderMaterial({
  vertexShader: instancedVertexShader,
  fragmentShader: instancedFragmentShader,
  uniforms: {
    opacity: { value: 0.25 },
  },
  transparent: true,
});
