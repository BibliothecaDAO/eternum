import { diffuseColor } from "three/tsl";
import MeshStandardNodeMaterial from "three/src/materials/nodes/MeshStandardNodeMaterial.js";
import MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import type NodeMaterial from "three/src/materials/nodes/NodeMaterial.js";
import type NodeBuilder from "three/src/nodes/core/NodeBuilder.js";
import StandardNodeLibrary from "three/src/renderers/webgpu/nodes/StandardNodeLibrary.js";
import { applyGameEndFrost } from "./game-end-freeze";

export class FrostedStandardNodeMaterial extends MeshStandardNodeMaterial {
  override setupDiffuseColor(builder: NodeBuilder): void {
    super.setupDiffuseColor(builder);
    // Coat solid surfaces and cutout foliage, preserving translucent glow cards.
    if (!this.transparent || this.alphaTest > 0) {
      diffuseColor.rgb.assign(applyGameEndFrost(diffuseColor.rgb));
    }
  }
}

class FrostedArmyNodeMaterial extends MeshBasicNodeMaterial {
  override setupDiffuseColor(builder: NodeBuilder): void {
    super.setupDiffuseColor(builder);
    if (builder.object.userData.gameEndFrost) diffuseColor.rgb.assign(applyGameEndFrost(diffuseColor.rgb));
  }
}

/** Use the renderer's material conversion so authored textures, vertex colors and instance colors survive coating. */
export class GameMapMaterialLibrary extends StandardNodeLibrary {
  declare materialNodes: Map<string, new () => NodeMaterial>;

  constructor() {
    super();
    this.materialNodes.set("MeshStandardMaterial", FrostedStandardNodeMaterial);
    this.materialNodes.set("MeshBasicMaterial", FrostedArmyNodeMaterial);
  }
}
