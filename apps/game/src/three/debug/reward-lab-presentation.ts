import { Group } from "three";
import { ChestPresentation } from "../rewards/chest-presentation";
import { resolveRewardNightAmount } from "../rewards/reward-lighting";

export const CHEST_PALETTES = {
  ivory: { label: "Ivory & gold", shell: "#fff1cd" },
  lavender: { label: "Light purple & gold", shell: "#bc9de8" },
} as const;
export type ChestPalette = keyof typeof CHEST_PALETTES;

/** Lab alternatives use the same finish, orientation and night glow as the game. */
export class RewardLabChestPresentation extends ChestPresentation {
  constructor(object: Group, palette: ChestPalette) {
    super(object, CHEST_PALETTES[palette].shell);
  }

  setLighting(lighting: "day" | "night"): void {
    this.setNightAmount(resolveRewardNightAmount(lighting === "night" ? 0 : 42));
  }
}
