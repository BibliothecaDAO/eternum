import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";

// Shared visual primitives for every element in the top zone. One source of
// truth so every pill / icon button in the top bar reads as the same strip,
// instead of mismatched chips (h-8 here, h-10 there, py-1 elsewhere…).
//
// Mobile/laptop: h-9 (36px). Desktop (md+): h-10 (40px). The breakpoint mirrors
// the other CircleButton sizes that already grow at md. Pair the icon-button
// form with `<CircleButton size="topbar" .../>` so circular icons line up.

export const TOP_PILL =
  `pointer-events-auto inline-flex h-9 md:h-10 items-center gap-2 rounded-full px-3.5 md:px-4 ${OVERLAY_SURFACE_BASE}`;

export const TOP_PILL_TEXT =
  "text-[11px] md:text-xs font-semibold uppercase tracking-[0.16em] text-gold tabular-nums";
