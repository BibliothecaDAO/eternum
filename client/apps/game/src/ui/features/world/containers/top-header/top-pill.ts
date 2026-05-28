import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";

// Shared visual primitives for every element in the top zone. One source of
// truth so every pill / icon button in the top bar reads as the same strip,
// instead of mismatched chips (h-8 here, h-10 there, py-1 elsewhere…).
//
// The fixed `h-9` (36px) sits between the breakpoint-driven CircleButton sizes
// (h-8 mobile, h-10 desktop). Pair the icon-button form with
// `<CircleButton size="topbar" .../>` so circular icons line up with the pills.

export const TOP_PILL =
  `pointer-events-auto inline-flex h-9 items-center gap-2 rounded-full px-3.5 ${OVERLAY_SURFACE_BASE}`;

export const TOP_PILL_TEXT = "text-[11px] font-semibold uppercase tracking-[0.16em] text-gold tabular-nums";
