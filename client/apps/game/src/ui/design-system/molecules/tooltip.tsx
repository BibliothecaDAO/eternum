import { useUIStore } from "@/hooks/store/use-ui-store";
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

export const Tooltip = ({ className }: TooltipProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const tooltip = useUIStore((state) => state.tooltip);
  const [placement, setPlacement] = useState<TooltipPlacement>("top");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);

  const anchorElement = tooltip?.anchorElement ?? undefined;

  const preferredPlacement = tooltip?.position ?? "top";

  const orderedPlacements = useMemo(() => {
    const available: Record<TooltipPlacement, number> = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    };

    if (anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      available.top = rect.top;
      available.bottom = window.innerHeight - rect.bottom;
      available.left = rect.left;
      available.right = window.innerWidth - rect.right;
    }

    const others = PLACEMENTS.filter((value) => value !== preferredPlacement);
    others.sort((a, b) => available[b] - available[a]);

    return [preferredPlacement, ...others];
  }, [anchorElement, preferredPlacement]);

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

    const calculateAndSetPosition = () => {
      const rect = anchor.getBoundingClientRect();
      const tooltipWidth = element.offsetWidth;
      const tooltipHeight = element.offsetHeight;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const calculate = (targetPlacement: TooltipPlacement) => {
        let top = rect.top;
        let left = rect.left;

        switch (targetPlacement) {
          case "top":
            top = rect.top - tooltipHeight - TOOLTIP_GAP;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case "bottom":
            top = rect.bottom + TOOLTIP_GAP;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case "left":
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = rect.left - tooltipWidth - TOOLTIP_GAP;
            break;
          case "right":
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = rect.right + TOOLTIP_GAP;
            break;
          default:
            break;
        }

        const fitsVertically = top >= VIEWPORT_PADDING && top + tooltipHeight <= viewportHeight - VIEWPORT_PADDING;
        const fitsHorizontally = left >= VIEWPORT_PADDING && left + tooltipWidth <= viewportWidth - VIEWPORT_PADDING;

        top = Math.min(Math.max(top, VIEWPORT_PADDING), viewportHeight - tooltipHeight - VIEWPORT_PADDING);
        left = Math.min(Math.max(left, VIEWPORT_PADDING), viewportWidth - tooltipWidth - VIEWPORT_PADDING);

        return {
          left,
          top,
          fits: fitsHorizontally && fitsVertically,
        };
      };

      let resolvedPlacement: TooltipPlacement = preferredPlacement;
      let resolvedPosition = calculate(preferredPlacement);

      if (!resolvedPosition.fits) {
        for (const option of orderedPlacements) {
          const position = calculate(option);
          resolvedPlacement = option;
          resolvedPosition = position;
          if (position.fits) break;
        }
      }

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
  }, [tooltip, anchorElement, orderedPlacements, preferredPlacement]);

  useEffect(() => {
    if (!tooltip) {
      setIsVisible(false);
      setCoordinates(null);
    }
  }, [tooltip]);

  useEffect(() => {
    const clearTooltip = () => {
      const setTooltip = useUIStore.getState().setTooltip;
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

  return (
    <>
      {tooltip && tooltip.content && (
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
            "fixed z-[250] pointer-events-none select-none panel-wood inline-flex border text-xs px-4 py-2 bg-dark-wood flex-col justify-start items-center text-gold transition-all duration-150 ease-out",
            className,
          )}
        >
          {tooltip.content}
        </div>
      )}
    </>
  );
};
