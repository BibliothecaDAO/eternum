import type { RendererFxCapabilities } from "../renderer-fx-capabilities";

export function shouldPlayArmyMovementFx(input: {
  capabilities: RendererFxCapabilities;
  movementType: "explore" | "travel";
}): boolean {
  return input.capabilities.supportsSpriteSceneFx || input.capabilities.supportsBillboardMeshFx;
}
