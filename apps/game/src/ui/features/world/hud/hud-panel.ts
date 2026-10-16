import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";

/** The HUD's panel: the overlay surface (teal under the Blitz and Eternum HUD), rounded, tightly padded, taking the pointer. */
export const HUD_PANEL = cn(OVERLAY_SURFACE_BASE, "pointer-events-auto rounded-xl px-3 py-2");
