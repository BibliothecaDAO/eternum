import { useAudio } from "@/audio/hooks/useAudio";
import { type SurfaceAnchor, usePopoverStore } from "@/hooks/store/use-popover-store";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import type { LucideIcon } from "lucide-react";
import X from "lucide-react/dist/esm/icons/x";
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PANEL_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;
const HEADER_CLEARANCE_PX = 56;

type PopoverAlign = "start" | "end";

interface PopoverPanelProps {
  id: string;
  ariaLabel: string;
  align: PopoverAlign;
  className?: string;
  children: ReactNode;
  /** The rect the panel hangs from; null hangs it from the top centre of the viewport. */
  resolveAnchor: () => SurfaceAnchor | null;
  /** Pointer-downs inside the anchor are the trigger's own clicks, never an outside dismiss. */
  isInsideAnchor: (target: EventTarget | null) => boolean;
}

/** The one panel: portaled to the body, capped to the viewport, closed by Escape or a pointer-down outside. */
const PopoverPanel = ({
  id,
  ariaLabel,
  align,
  className,
  children,
  resolveAnchor,
  isInsideAnchor,
}: PopoverPanelProps) => {
  const close = usePopoverStore((state) => state.close);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    const place = () => setPanelStyle(resolvePanelStyle(resolveAnchor(), align));
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [align, resolveAnchor]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (isInsideAnchor(event.target) || isInside(event.target, panelRef.current)) return;
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
  }, [close, id, isInsideAnchor]);

  if (!panelStyle) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      data-popover-panel={id}
      className={cn("pointer-events-auto fixed z-[130] w-80 rounded-xl p-4 text-gold", OVERLAY_SURFACE_BASE, className)}
      style={panelStyle}
    >
      {children}
    </div>,
    document.body,
  );
};

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
 * outside it, never covers the page with a scrim, and at most one is open at a time (`usePopoverStore`). The
 * trigger opens it through the store (`toggle(id)`); the panel is capped to the viewport on the side it grows
 * towards, so wide content shrinks instead of leaving the screen. Anything a fast transaction can answer renders
 * here instead of in a modal.
 */
export const Popover = ({ id, trigger, children, ariaLabel, align = "start", className }: PopoverProps) => {
  const isOpen = usePopoverStore((state) => state.openId === id);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const resolveAnchor = useRef(() => anchorRef.current?.getBoundingClientRect() ?? null).current;
  const isInsideAnchor = useRef((target: EventTarget | null) => isInside(target, anchorRef.current)).current;

  return (
    <>
      <span ref={anchorRef} className="inline-flex" data-popover-anchor={id}>
        {trigger}
      </span>
      {isOpen && (
        <PopoverPanel
          id={id}
          ariaLabel={ariaLabel}
          align={align}
          className={className}
          resolveAnchor={resolveAnchor}
          isInsideAnchor={isInsideAnchor}
        >
          {children}
        </PopoverPanel>
      )}
    </>
  );
};

const neverInsideAnchor = () => false;

/**
 * Renders the store's surface — content handed to `openSurface` by a scene click or a plain button — through the
 * same panel, hanging from the rect it was opened at (or the top centre when it has none). Mounted once in the HUD.
 */
export const SurfaceHost = () => {
  const surface = usePopoverStore((state) => state.surface);
  const isOpen = usePopoverStore((state) => state.surface !== null && state.openId === state.surface.id);
  const { play } = useAudio();
  const wasOpenRef = useRef(false);
  const resolveAnchor = useRef(() => usePopoverStore.getState().surface?.anchor ?? null).current;

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) play("ui.modal_open");
    else if (!isOpen && wasOpenRef.current) play("ui.modal_close");
    wasOpenRef.current = isOpen;
  }, [isOpen, play]);

  if (!surface || !isOpen) return null;

  return (
    <PopoverPanel
      id={surface.id}
      ariaLabel={surface.id}
      align="start"
      className="w-auto p-0"
      resolveAnchor={resolveAnchor}
      isInsideAnchor={neverInsideAnchor}
    >
      {surface.content}
    </PopoverPanel>
  );
};

interface PopoverHeaderProps {
  title: ReactNode;
  icon?: LucideIcon;
  onClose: () => void;
}

/** The header strip for a large surface: title, optional icon, close. */
const PopoverHeader = ({ title, icon: Icon, onClose }: PopoverHeaderProps) => (
  <div className="flex items-center justify-between gap-2 border-b border-gold/15 px-4 py-2.5">
    <span className={cn("flex items-center gap-2", HUD_LABEL_BRIGHT)}>
      {Icon && <Icon className="h-4 w-4 text-gold" />}
      {title}
    </span>
    <button
      type="button"
      onClick={onClose}
      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-gold/30 bg-black/30 text-gold/80 transition hover:border-gold hover:bg-gold/15 hover:text-gold"
      aria-label="Close"
      title="Close"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
);

interface SurfaceFrameProps {
  title: ReactNode;
  icon?: LucideIcon;
  onClose: () => void;
  footer?: ReactNode;
  /** Width and height of the surface, e.g. `w-[1320px] h-[calc(100vh-7rem)]`; the panel caps both to the viewport. */
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** A large surface's frame: the header strip over a scrolling body, with an optional footer. */
export const SurfaceFrame = ({
  title,
  icon,
  onClose,
  footer,
  className,
  bodyClassName,
  children,
}: SurfaceFrameProps) => (
  <div className={cn("flex max-w-full flex-col", className)}>
    <PopoverHeader title={title} icon={icon} onClose={onClose} />
    <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
    {footer && <div className="border-t border-gold/15 p-4">{footer}</div>}
  </div>
);

/** The rect a surface should hang from when a button opens it. */
export const surfaceAnchorFrom = (element: Element): SurfaceAnchor => {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
};

const resolvePanelStyle = (anchor: SurfaceAnchor | null, align: PopoverAlign): CSSProperties => {
  if (!anchor) {
    const top = HEADER_CLEARANCE_PX;
    return {
      top,
      left: "50%",
      transform: "translateX(-50%)",
      maxHeight: Math.max(0, window.innerHeight - top - VIEWPORT_MARGIN_PX),
      maxWidth: Math.max(0, window.innerWidth - 2 * VIEWPORT_MARGIN_PX),
    };
  }
  const top = anchor.bottom + PANEL_GAP_PX;
  const maxHeight = Math.max(0, window.innerHeight - top - VIEWPORT_MARGIN_PX);
  if (align === "end") {
    const right = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - anchor.right);
    return { top, right, maxHeight, maxWidth: Math.max(0, window.innerWidth - right - VIEWPORT_MARGIN_PX) };
  }
  const left = Math.max(VIEWPORT_MARGIN_PX, anchor.left);
  return { top, left, maxHeight, maxWidth: Math.max(0, window.innerWidth - left - VIEWPORT_MARGIN_PX) };
};

const isInside = (target: EventTarget | null, element: HTMLElement | null): boolean =>
  element !== null && target instanceof Node && element.contains(target);
