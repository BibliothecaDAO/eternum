/**
 * Etched Bronze — the canonical surface for every floating overlay element
 * in the HUD: top pills, view-switcher icons, floating view panel,
 * right-side info bubbles, minimap panel.
 *
 * The same border / gradient / inner-highlight tokens are reused everywhere
 * so the four zones (top, left, right, bottom-left) read as one design
 * system. Per-surface variations (radius, padding) are controlled by the
 * consuming component.
 *
 * Tokens:
 *  - Base: a subtle warm dark gradient (from stone-black to bronze-brown)
 *    so surfaces feel metallic rather than purely translucent.
 *  - Border: hairline gold (`gold/30`) using the existing palette token.
 *  - Inner highlight: a 1px gold inset along the top to suggest a polished
 *    edge — the "etched" part of the name.
 *  - Drop shadow: soft, large, dark — anchors the surface above the map.
 *  - Backdrop blur: small, just enough to separate from busy hex terrain.
 *
 * Active state lifts the border, adds a ring + amber glow.
 * Hover (for clickable surfaces) brightens the border slightly.
 */

export const OVERLAY_SURFACE_BASE =
  "border border-gold/30 bg-gradient-to-b from-[#1a1410]/95 to-[#231a10]/95 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(223,170,84,0.18)] backdrop-blur-sm";

export const OVERLAY_SURFACE_HOVER =
  "transition-[border-color,box-shadow,background-color] duration-150 hover:border-gold/50";

export const OVERLAY_SURFACE_ACTIVE =
  "border-gold/65 ring-1 ring-gold/30 shadow-[0_0_18px_rgba(223,170,84,0.3),inset_0_1px_0_rgba(255,214,102,0.28)]";

/**
 * Convenience composite for clickable pill surfaces — the most common case
 * across the HUD. Combines base + hover transition.
 */
const OVERLAY_PILL_CLICKABLE = `${OVERLAY_SURFACE_BASE} ${OVERLAY_SURFACE_HOVER}`;

/**
 * Shared trigger surface for dropdown/select inputs so every dropdown in a
 * panel (biome, troop type, tier, relics, …) reads as the same control: a
 * dark inset field with a hairline gold border that brightens on hover.
 */
export const DROPDOWN_TRIGGER =
  "h-10 rounded-md border border-gold/30 bg-black/40 text-gold shadow-[inset_0_1px_0_rgba(223,170,84,0.08)] transition-colors hover:border-gold/55 hover:bg-black/30 focus:outline-none focus:border-gold/60";

/**
 * Matching surface for the floating dropdown panel/list. Uses a SOLID opaque
 * background — dropdown panels float over busy content, so any translucency
 * makes the options unreadable.
 */
export const DROPDOWN_CONTENT = "rounded-md border border-gold/40 !bg-[#15100a] text-gold shadow-2xl";
