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
