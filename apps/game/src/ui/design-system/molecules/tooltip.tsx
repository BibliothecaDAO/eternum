import { createPortal } from "react-dom";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useNamedTips } from "@/ui/design-system/kit/named-tips";
import { isCoarsePointer } from "@/utils/pointer";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type TooltipProps = {
  className?: string;
};

type TooltipPlacement = "top" | "bottom" | "left" | "right";

type Coordinates = {
  left: number;
  top: number;
};

const PLACEMENTS: TooltipPlacement[] = ["top", "bottom", "left", "right"];
const VIEWPORT_PADDING = 8;
const TOOLTIP_GAP = 12;
/** The HUD's cards: its panels and the frames of what it opens. */
const CARD = ".ui-panel";

/**
 * The card a thing belongs to: the outermost HUD card it sits in (a store card opened inside the realm's panel belongs
 * to the realm's panel), or none.
 */
const cardOf = (anchor: HTMLElement): HTMLElement | null => {
  let card: HTMLElement | null = null;
  for (let at = anchor.closest<HTMLElement>(CARD); at; at = at.parentElement?.closest<HTMLElement>(CARD) ?? null)
    card = at;
  return card;
};

/** A card's side that faces the middle of the screen, where the map has room: a left column's right. */
const sideFacingTheMiddle = (card: DOMRect): TooltipPlacement =>
  card.left + card.width / 2 < window.innerWidth / 2 ? "right" : "left";

/** Each side's room on the screen around a box, the roomiest first after the preferred one. */
const placementsAround = (box: DOMRect, preferred: TooltipPlacement): TooltipPlacement[] => {
  const room: Record<TooltipPlacement, number> = {
    top: box.top,
    bottom: window.innerHeight - box.bottom,
    left: box.left,
    right: window.innerWidth - box.right,
  };
  return [preferred, ...PLACEMENTS.filter((side) => side !== preferred).toSorted((a, b) => room[b] - room[a])];
};

const getHiddenTransform = (placement: TooltipPlacement) => {
  switch (placement) {
    case "bottom":
      return "translate3d(0, -6px, 0)";
    case "left":
      return "translate3d(6px, 0, 0)";
    case "right":
      return "translate3d(-6px, 0, 0)";
    case "top":
    default:
      return "translate3d(0, 6px, 0)";
  }
};

/**
 * The app's one tooltip, and the kit's names with it (hover, keyboard focus, press-and-hold). A touch device has no
 * hover (a tap fires mouseenter with no leave, so a hover tooltip would stick): there it draws only a name a hold
 * asked for.
 */
export const Tooltip = ({ className }: TooltipProps) => {
  useNamedTips();
  const held = useTooltipStore((state) => state.tooltip?.held === true);
  return isCoarsePointer() && !held ? null : <HoverTooltip className={className} />;
};

const HoverTooltip = ({ className }: TooltipProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const tooltip = useTooltipStore((state) => state.tooltip);
  const [placement, setPlacement] = useState<TooltipPlacement>("top");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);

  const anchorElement = tooltip?.anchorElement ?? undefined;

  const preferredPlacement = tooltip?.position ?? "top";

  useEffect(() => {
    const updatePointerPosition = (event: PointerEvent | MouseEvent) => {
      pointerPositionRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("pointermove", updatePointerPosition, { passive: true });
    window.addEventListener("mousemove", updatePointerPosition, { passive: true });

    return () => {
      window.removeEventListener("pointermove", updatePointerPosition);
      window.removeEventListener("mousemove", updatePointerPosition);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tooltip || tooltip.fixed) {
      if (tooltip?.fixed) {
        setPlacement("top");
        setCoordinates({ left: tooltip.fixed.x, top: tooltip.fixed.y });
        setIsVisible(true);
      }
      return;
    }

    setIsVisible(false);

    const element = ref.current;
    const anchor = anchorElement ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    if (!element || !anchor) {
      const pointerPosition = pointerPositionRef.current;

      if (element && pointerPosition) {
        const tooltipWidth = element.offsetWidth;
        const tooltipHeight = element.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top = pointerPosition.y - tooltipHeight - TOOLTIP_GAP;
        let left = pointerPosition.x - tooltipWidth / 2;

        top = Math.min(Math.max(top, VIEWPORT_PADDING), viewportHeight - tooltipHeight - VIEWPORT_PADDING);
        left = Math.min(Math.max(left, VIEWPORT_PADDING), viewportWidth - tooltipWidth - VIEWPORT_PADDING);

        setPlacement(preferredPlacement);
        setCoordinates({ left, top });
        requestAnimationFrame(() => setIsVisible(true));
      } else {
        setCoordinates(null);
        setIsVisible(false);
      }

      return;
    }

    /**
     * A tip stands clear of the card its thing belongs to (playtest 10-31: the realm's wheat ring named itself over the
     * card's header): beside the card at the thing's height, on the side facing the map, or above or below it where a
     * card spans the screen's width (a phone's sheet). Only a card that leaves no room on any side has its tip at the
     * thing itself, as a thing on no card has.
     */
    const calculateAndSetPosition = () => {
      const rect = anchor.getBoundingClientRect();
      const tooltipWidth = element.offsetWidth;
      const tooltipHeight = element.offsetHeight;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      /** The tip on a side of `around` (the card, or the thing), centred on the thing along that side. */
      const calculate = (targetPlacement: TooltipPlacement, around: DOMRect) => {
        let top = rect.top;
        let left = rect.left;

        switch (targetPlacement) {
          case "top":
            top = around.top - tooltipHeight - TOOLTIP_GAP;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case "bottom":
            top = around.bottom + TOOLTIP_GAP;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case "left":
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = around.left - tooltipWidth - TOOLTIP_GAP;
            break;
          case "right":
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = around.right + TOOLTIP_GAP;
            break;
          default:
            break;
        }

        const fitsVertically = top >= VIEWPORT_PADDING && top + tooltipHeight <= viewportHeight - VIEWPORT_PADDING;
        const fitsHorizontally = left >= VIEWPORT_PADDING && left + tooltipWidth <= viewportWidth - VIEWPORT_PADDING;

        top = Math.min(Math.max(top, VIEWPORT_PADDING), viewportHeight - tooltipHeight - VIEWPORT_PADDING);
        left = Math.min(Math.max(left, VIEWPORT_PADDING), viewportWidth - tooltipWidth - VIEWPORT_PADDING);

        // A tooltip above or below its anchor slides along the edge it would cross; only its own axis can refuse it.
        const besideAnchor = targetPlacement === "left" || targetPlacement === "right";
        return {
          left,
          top,
          fits: besideAnchor ? fitsHorizontally : fitsVertically,
        };
      };

      /** The first side of `around` the tip fits on, in `order`; the last one tried when none fits. */
      const resolve = (around: DOMRect, order: TooltipPlacement[]) => {
        const sides = order.map((placement) => ({ placement, ...calculate(placement, around) }));
        return sides.find((side) => side.fits) ?? sides[sides.length - 1];
      };

      const card = cardOf(anchor)?.getBoundingClientRect();
      const clearOfCard = card && resolve(card, placementsAround(card, sideFacingTheMiddle(card)));
      const { placement: resolvedPlacement, ...resolvedPosition } = clearOfCard?.fits
        ? clearOfCard
        : resolve(rect, placementsAround(rect, preferredPlacement));

      setPlacement(resolvedPlacement);
      setCoordinates({ left: resolvedPosition.left, top: resolvedPosition.top });
      requestAnimationFrame(() => setIsVisible(true));
    };

    calculateAndSetPosition();

    window.addEventListener("resize", calculateAndSetPosition);
    window.addEventListener("scroll", calculateAndSetPosition, true);

    return () => {
      window.removeEventListener("resize", calculateAndSetPosition);
      window.removeEventListener("scroll", calculateAndSetPosition, true);
    };
  }, [tooltip, anchorElement, preferredPlacement]);

  useEffect(() => {
    if (!tooltip) {
      setIsVisible(false);
      setCoordinates(null);
    }
  }, [tooltip]);

  useEffect(() => {
    const clearTooltip = () => {
      const setTooltip = useTooltipStore.getState().setTooltip;
      setTooltip(null);
    };

    document.addEventListener("click", clearTooltip);
    document.addEventListener("dragstart", clearTooltip);

    return () => {
      document.removeEventListener("click", clearTooltip);
      document.removeEventListener("dragstart", clearTooltip);
    };
  }, []);

  const style = tooltip?.fixed
    ? { left: tooltip.fixed.x, top: tooltip.fixed.y }
    : coordinates
      ? { left: `${coordinates.left}px`, top: `${coordinates.top}px` }
      : undefined;

  const hiddenTransform = useMemo(() => getHiddenTransform(placement), [placement]);

  if (!tooltip || !tooltip.content) return null;

  // Desks and popovers portal to the body above the HUD tree; the tooltip must live there too or it renders behind them.
  return createPortal(
    <div
      id="tooltip-root"
      ref={ref}
      data-placement={placement}
      role="tooltip"
      aria-hidden={!isVisible}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translate3d(0, 0, 0)" : hiddenTransform,
      }}
      className={clsx(
        "ui ui-tip pointer-events-none fixed z-hud-tip select-none",
        // A held name is there the moment the hold is long enough; a hovered one eases in.
        !tooltip.held && "transition-all duration-150 ease-out",
        className,
      )}
    >
      {tooltip.content}
    </div>,
    document.body,
  );
};
