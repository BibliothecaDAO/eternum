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
  float edgeDistance = length(vPosition.xy) * 0.15;
  float gradient = smoothstep(1.0, 0.0, edgeDistance); 
  float finalOpacity = mix(1.0, opacity, gradient);
  
  gl_FragColor = vec4(color, finalOpacity);
}
`;

export const placeholderMaterial = new ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    color: { value: new Color("green") },
    opacity: { value: 0.15 },
  },
  transparent: true,
});
