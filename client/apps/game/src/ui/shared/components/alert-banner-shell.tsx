import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { ReactNode } from "react";

interface AlertBannerShellProps {
  /** Tailwind class for the colored left accent edge (severity/category). */
  accentEdgeClassName: string;
  children: ReactNode;
}

/**
 * Shared bronze chrome for the top-center alert banners (network status,
 * news headlines). Renders the 520px framed surface, top hairline, gradient
 * sheen and the colored left accent edge; consumers fill the grid body and
 * keep their own AnimatePresence/motion wrapper for enter/exit.
 *
 * Replaces the old per-banner wood frame (panel-wood-corners + bg-dark-wood)
 * frame (with ornate corner divs) that was duplicated across both banners.
 */
export const AlertBannerShell = ({ accentEdgeClassName, children }: AlertBannerShellProps) => (
  <div className="w-[520px] max-w-full">
    <div className="pointer-events-auto relative overflow-hidden rounded-xl border border-gold/30 bg-[#1a1410]/95 text-gold shadow-[0_25px_45px_-25px_rgba(0,0,0,0.8)] backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/20" />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      <div className={cn("pointer-events-none absolute inset-y-4 left-0 w-[2px] rounded-full", accentEdgeClassName)} />
      {children}
    </div>
  </div>
);
