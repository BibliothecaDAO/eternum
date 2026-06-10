/**
 * Unified typography for every floating HUD surface (top pills, right-side
 * info bubbles, view-switcher icons, minimap, picker popover, etc).
 *
 * One small system, used everywhere, so the four zones stop looking like
 * four different products:
 *
 *   - LABEL   — small caps section/header text. Used for "STRUCTURE TILE",
 *               "GUARDS", "BIOME", pill captions like "Local · World".
 *   - LABEL_BRIGHT — same shape, higher-contrast color. Used for active
 *                    pill text where the label IS the primary content
 *                    (e.g. rank pill "#3 · 110 PTS", identity badge).
 *   - CUE     — small caps modifier that sits next to a LABEL ("1/1",
 *               "0%"). Same metrics, lower opacity so it reads as
 *               secondary.
 *   - BODY    — readable mid-sized prose / data ("No production
 *               buildings", "1m ago · next in 23s").
 *   - BODY_MUTED — italic + low opacity for empty states.
 *   - VALUE   — semibold numeric / status value ("1500", "+30%", "1.5K").
 *   - HEADLINE — larger semibold headline ("djizus", "Tropical Seasonal
 *                Forest", structure names inside bubbles).
 *
 * All HUD surfaces drop font-[Cinzel] — that was making some elements
 * read as a different family from the rest of the chrome. The default
 * sans-serif renders smaller sizes more legibly and unifies the look.
 */

export const HUD_LABEL = "text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/70";
export const HUD_LABEL_BRIGHT = "text-[11px] font-semibold uppercase tracking-[0.16em] text-gold";
export const HUD_CUE = "text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/55";
export const HUD_BODY = "text-[11px] text-gold/85";
export const HUD_BODY_MUTED = "text-[11px] italic text-gold/55";
export const HUD_VALUE = "text-[12px] font-semibold text-gold";
export const HUD_HEADLINE = "text-[14px] font-semibold text-gold";
