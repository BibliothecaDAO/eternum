import { attribute, materialOpacity, varying } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

const plotColor = varying(attribute("color", "vec4"), "vPlotColor");

export const interactiveHexMaterial = new MeshBasicNodeMaterial({
  transparent: true,
  opacity: 1,
  depthWrite: false,
  toneMapped: false,
});
interactiveHexMaterial.colorNode = plotColor.rgb;
interactiveHexMaterial.opacityNode = plotColor.a.mul(materialOpacity);
