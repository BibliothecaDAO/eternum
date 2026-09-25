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
 * The caps, italic and size choices are classes (hud-caps, hud-muted, hud-body, hud-value, index.css) so a mode can
 * restyle them in one place: Frontier reads in sentence case, never italic, at dyslexia-friendly sizes.
 *
 * All HUD surfaces drop font-[Cinzel] — that was making some elements
 * read as a different family from the rest of the chrome. The default
 * sans-serif renders smaller sizes more legibly and unifies the look.
 */

export const HUD_LABEL = "hud-caps text-[10px] font-semibold text-gold/70";
export const HUD_LABEL_BRIGHT = "hud-caps-tight text-[11px] font-semibold text-gold";
export const HUD_CUE = "hud-caps text-[10px] font-semibold text-gold/55";
export const HUD_BODY = "hud-body text-[11px] text-gold/85";
export const HUD_BODY_MUTED = "hud-body hud-muted text-[11px] text-gold/55";
export const HUD_VALUE = "hud-value text-[12px] font-semibold text-gold";
export const HUD_HEADLINE = "text-[14px] font-semibold text-gold";
