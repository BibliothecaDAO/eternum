/**
 * The HUD's type roles, one per job, on the app's one scale (decisions-1): 14 for labels, 16 for text and numbers,
 * 20 for headlines; sentence case, upright, untracked. Text that must be read is cream or the muted token; gold marks
 * what can be pressed or what was earned.
 *
 *   - LABEL        — names a section or a value ("Guards", "Biome", "Local").
 *   - LABEL_BRIGHT — a label that is itself the content of a pill (the player's name and rank).
 *   - CUE          — a quiet modifier beside a label ("1/1", "0%").
 *   - BODY         — readable prose or data ("No production buildings", "1m ago · next in 23s").
 *   - BODY_MUTED   — an empty state or an aside.
 *   - VALUE        — a number or a status value ("1,500", "+30%").
 *   - HEADLINE     — a panel's subject ("djizus", "Tropical Seasonal Forest").
 */

export const HUD_LABEL = "text-sm font-semibold text-kit-muted";
export const HUD_LABEL_BRIGHT = "text-sm font-semibold text-kit-cream";
export const HUD_CUE = "text-sm text-kit-muted";
export const HUD_BODY = "text-base text-kit-cream";
export const HUD_BODY_MUTED = "text-base text-kit-muted";
export const HUD_VALUE = "text-base font-semibold tabular-nums text-kit-cream";
export const HUD_HEADLINE = "text-xl font-semibold text-kit-cream";
