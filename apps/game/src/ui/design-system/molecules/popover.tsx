import { useAudio } from "@/audio/hooks/useAudio";
import { type PopoverMapClick, type SurfaceAnchor, usePopoverStore } from "@/hooks/store/use-popover-store";
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

/** An edge of the viewport a surface can hang from instead of a rect. */
type PanelEdge = "top-center" | "right-edge" | "bottom-right";

type PanelAnchor = SurfaceAnchor | PanelEdge;

interface PopoverPanelProps {
  id: string;
  ariaLabel: string;
  /** What the panel hangs from: a rect (live, when a function) or a viewport edge. */
  anchor: PanelAnchor | (() => PanelAnchor);
  align?: PopoverAlign;
  className?: string;
  children: ReactNode;
  /** Escape or a pointer-down outside the panel (and outside its anchor) asks the owner to close it. */
  onDismiss: () => void;
  /** Map clicks may reanchor through the scene hit test; all other outside clicks dismiss. */
  mapClick?: PopoverMapClick;
  /** Pointer-downs inside the anchor are the trigger's own clicks, never an outside dismiss. */
  isInsideAnchor?: (target: EventTarget | null) => boolean;
}

const neverInsideAnchor = () => false;

/**
 * The one panel: portaled to the body, capped to the viewport, closed by Escape or a pointer-down outside. It is
 * store-free — whoever mounts it owns its open state — so a view-driven surface (the sidebar's Build, Military,
 * Logistics and Chat), a store popover and a store surface all render through exactly this.
 */
export const PopoverPanel = ({
  id,
  ariaLabel,
  anchor,
  align = "start",
  className,
  children,
  onDismiss,
  isInsideAnchor = neverInsideAnchor,
  mapClick = "dismiss",
}: PopoverPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const resolveAnchor = typeof anchor === "function" ? anchor : () => anchor;
  const resolveAnchorRef = useRef(resolveAnchor);
  resolveAnchorRef.current = resolveAnchor;
  const mapClickRef = useRef(mapClick);
  mapClickRef.current = mapClick;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const isInsideAnchorRef = useRef(isInsideAnchor);
  isInsideAnchorRef.current = isInsideAnchor;

  useLayoutEffect(() => {
    const place = () => setPanelStyle(resolvePanelStyle(resolveAnchorRef.current(), align, panelRef.current));
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [align, anchor, Boolean(panelStyle)]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (isInsideAnchorRef.current(event.target) || isInside(event.target, panelRef.current)) return;
      const policy = mapClickRef.current;
      if (event.target instanceof HTMLCanvasElement && policy !== "dismiss" && policy.reanchor(event)) return;
      onDismissRef.current();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onDismissRef.current();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (!panelStyle) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      data-popover-panel={id}
      className={cn(
        "pointer-events-auto fixed z-[130] w-80 overflow-y-auto rounded-xl p-4 text-gold",
        OVERLAY_SURFACE_BASE,
        className,
      )}
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
  const close = usePopoverStore((state) => state.close);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const resolveAnchor = useRef((): PanelAnchor => anchorRef.current?.getBoundingClientRect() ?? "top-center").current;
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
          anchor={resolveAnchor}
          align={align}
          className={className}
          onDismiss={() => close(id)}
          isInsideAnchor={isInsideAnchor}
        >
          {children}
        </PopoverPanel>
      )}
    </>
  );
};

/**
 * Renders the store's surface — content handed to `openSurface` by a scene click or a plain button — through the
 * same panel, hanging from the rect it was opened at (or the top centre when it has none). Mounted once in the HUD.
 */
export const SurfaceHost = () => {
  const surface = usePopoverStore((state) => state.surface);
  const isOpen = usePopoverStore((state) => state.surface !== null && state.openId === state.surface.id);
  const close = usePopoverStore((state) => state.close);
  const { play } = useAudio();
  const wasOpenRef = useRef(false);

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
      anchor={surface.anchor ?? "top-center"}
      mapClick={surface.mapClick}
      className="w-auto p-0"
      onDismiss={() => close(surface.id)}
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

const resolvePanelStyle = (anchor: PanelAnchor, align: PopoverAlign, panel: HTMLElement | null): CSSProperties => {
  const maxWidth = Math.max(0, window.innerWidth - 2 * VIEWPORT_MARGIN_PX);
  if (anchor === "top-center") {
    const top = HEADER_CLEARANCE_PX;
    return { top, left: "50%", transform: "translateX(-50%)", maxHeight: viewportHeightBelow(top), maxWidth };
  }
  if (anchor === "right-edge") {
    const top = HEADER_CLEARANCE_PX;
    return { top, right: VIEWPORT_MARGIN_PX, maxHeight: viewportHeightBelow(top), maxWidth };
  }
  if (anchor === "bottom-right") {
    return {
      bottom: VIEWPORT_MARGIN_PX,
      right: VIEWPORT_MARGIN_PX,
      maxHeight: viewportHeightBelow(HEADER_CLEARANCE_PX),
      maxWidth,
    };
  }
  const contentHeight = panel?.scrollHeight ?? 0;
  const below = anchor.bottom + PANEL_GAP_PX;
  const fitsAbove = anchor.top - PANEL_GAP_PX - contentHeight >= HEADER_CLEARANCE_PX;
  const preferredTop =
    contentHeight > viewportHeightBelow(below) && fitsAbove ? anchor.top - PANEL_GAP_PX - contentHeight : below;
  const visibleHeight = Math.min(contentHeight, viewportHeightBelow(HEADER_CLEARANCE_PX));
  const top = Math.max(HEADER_CLEARANCE_PX, Math.min(preferredTop, window.innerHeight - visibleHeight - VIEWPORT_MARGIN_PX));
  const maxHeight = viewportHeightBelow(top);
  if (align === "end") {
    const right = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - anchor.right);
    return { top, right, maxHeight, maxWidth: Math.max(0, window.innerWidth - right - VIEWPORT_MARGIN_PX) };
  }
  const left = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(anchor.left, window.innerWidth - (panel?.offsetWidth ?? 0) - VIEWPORT_MARGIN_PX),
  );
  return { top, left, maxHeight, maxWidth };
};

const viewportHeightBelow = (top: number): number => Math.max(0, window.innerHeight - top - VIEWPORT_MARGIN_PX);

const isInside = (target: EventTarget | null, element: HTMLElement | null): boolean =>
  element !== null && target instanceof Node && element.contains(target);
