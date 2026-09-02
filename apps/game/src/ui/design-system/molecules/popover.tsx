import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PANEL_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;

type PopoverAlign = "start" | "end";

interface PopoverProps {
  id: string;
  trigger: ReactNode;
  children: ReactNode;
  ariaLabel: string;
  align?: PopoverAlign;
  className?: string;
}

/**
 * The one anchored, non-blocking overlay. The panel hangs off its trigger, closes on Escape or a pointer-down
 * outside it, never covers the page with a scrim, and at most one is open at a time (`usePopoverStore`).
 * Anything a fast transaction can answer renders here instead of in a modal.
 */
export const Popover = ({ id, trigger, children, ariaLabel, align = "start", className }: PopoverProps) => {
  const isOpen = usePopoverStore((state) => state.openId === id);
  const toggle = usePopoverStore((state) => state.toggle);
  const close = usePopoverStore((state) => state.close);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelStyle(null);
      return;
    }

    const place = () => {
      const anchor = anchorRef.current;
      if (anchor) setPanelStyle(resolvePanelStyle(anchor.getBoundingClientRect(), align));
    };

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [align, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (isInside(event.target, anchorRef.current) || isInside(event.target, panelRef.current)) return;
      close(id);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close(id);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [close, id, isOpen]);

  return (
    <>
      <span ref={anchorRef} className="inline-flex" data-popover-anchor={id} onClick={() => toggle(id)}>
        {trigger}
      </span>
      {isOpen &&
        panelStyle &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={ariaLabel}
            data-popover-panel={id}
            className={cn(
              "pointer-events-auto fixed z-[130] w-80 max-w-[calc(100vw-1rem)] rounded-xl p-4 text-gold",
              OVERLAY_SURFACE_BASE,
              className,
            )}
            style={panelStyle}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
};

const resolvePanelStyle = (anchor: DOMRect, align: PopoverAlign): CSSProperties => {
  const top = anchor.bottom + PANEL_GAP_PX;
  if (align === "end") {
    return { top, right: Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - anchor.right) };
  }
  return { top, left: Math.max(VIEWPORT_MARGIN_PX, anchor.left) };
};

const isInside = (target: EventTarget | null, element: HTMLElement | null): boolean =>
  element !== null && target instanceof Node && element.contains(target);
