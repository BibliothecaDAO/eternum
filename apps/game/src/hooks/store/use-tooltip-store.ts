import type { ReactNode } from "react";
import { create } from "zustand";

type TooltipPlacement = "top" | "left" | "right" | "bottom";

type TooltipType = {
  content: ReactNode;
  position?: TooltipPlacement;
  anchorElement?: HTMLElement | null;
  fixed?: {
    x: number;
    y: number;
  };
} | null;

let lastResolvedAnchor: HTMLElement | null = null;

const isInDocument = (element: HTMLElement | null) => {
  if (!element) {
    return false;
  }

  return document.contains(element);
};

const INTERACTIVE_SELECTOR = "[data-tooltip-anchor], button, [role='button'], a, [data-radix-collection-item]";

const getFallbackAnchor = (existing?: HTMLElement | null): HTMLElement | null => {
  if (existing) {
    lastResolvedAnchor = existing;
    return existing;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const hovered = document.querySelectorAll(":hover");
  const lastHovered = hovered.length ? (hovered[hovered.length - 1] as HTMLElement) : null;
  const tooltipElement = document.getElementById("tooltip-root");

  if (lastHovered && tooltipElement && tooltipElement.contains(lastHovered)) {
    return null;
  }

  if (lastHovered) {
    const interactiveAncestor = lastHovered.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;

    if (interactiveAncestor) {
      lastResolvedAnchor = interactiveAncestor;
      return interactiveAncestor;
    }

    lastResolvedAnchor = lastHovered;
    return lastHovered;
  }

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (active) {
    const anchorCandidate = active.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
    if (anchorCandidate) {
      lastResolvedAnchor = anchorCandidate;
      return anchorCandidate;
    }
    lastResolvedAnchor = active;
    return active;
  }

  if (isInDocument(lastResolvedAnchor)) {
    return lastResolvedAnchor;
  }

  lastResolvedAnchor = null;

  return null;
};

interface TooltipStore {
  tooltip: TooltipType;
  setTooltip: (tooltip: TooltipType) => void;
}

/**
 * The hover tooltip in its own store: a hover writes here and nowhere else, so it never runs the UI store's
 * selectors (L6 — the tooltip was the hottest write on that store).
 */
export const useTooltipStore = create<TooltipStore>()((set) => ({
  tooltip: null,
  setTooltip: (tooltip) =>
    set({
      tooltip:
        tooltip && !tooltip.fixed
          ? {
              ...tooltip,
              anchorElement: getFallbackAnchor(tooltip.anchorElement ?? undefined),
            }
          : tooltip,
    }),
}));
