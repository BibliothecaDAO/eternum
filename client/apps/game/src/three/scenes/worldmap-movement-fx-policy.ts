import type { RendererFxCapabilities } from "../renderer-fx-capabilities";

export function shouldPlayArmyMovementFx(input: {
  capabilities: RendererFxCapabilities;
  movementType: "explore" | "travel";
}): boolean {
  if (!input.capabilities.supportsSpriteSceneFx && input.movementType === "explore") {
    return false;
  }

  return true;
}
