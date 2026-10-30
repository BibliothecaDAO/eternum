import type { NativePreset } from "./native-preset";

/** The preset's progression values in the native record shared by registration and display fixtures. */
export const nativeProgressionRules = (rules: NonNullable<NativePreset["progression"]>) => ({
  reveal_xp: rules.revealXp,
  reveal_xp_per_depth: rules.revealXpPerDepth,
  common_xp: rules.commonXp,
  uncommon_xp: rules.uncommonXp,
  rare_xp: rules.rareXp,
  epic_xp: rules.epicXp,
  legendary_xp: rules.legendaryXp,
});
