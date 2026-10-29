// Shared HUD panels use solid surfaces to keep text legible over the terrain.
export const OVERLAY_SURFACE_BASE =
  "border border-gold/25 bg-gradient-to-b from-[var(--overlay-surface-from)] to-[var(--overlay-surface-to)] shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgb(var(--kit-gold)/0.18)]";

export const OVERLAY_SURFACE_HOVER =
  "transition-[border-color,box-shadow,background-color] duration-150 hover:border-gold/50";

export const OVERLAY_SURFACE_ACTIVE =
  "border-gold/65 ring-1 ring-gold/30 shadow-[0_0_18px_rgb(var(--kit-gold)/0.16),inset_0_1px_0_rgba(255,214,102,0.28)]";
