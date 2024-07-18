import { Color, ShaderMaterial } from "three";

export const borderHexMaterial = new ShaderMaterial({
  uniforms: {
    color: { value: new Color("brown") },
    opacity: { value: 0.1 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    uniform float opacity;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(color, opacity);
    }
  `,
  transparent: true,
});
