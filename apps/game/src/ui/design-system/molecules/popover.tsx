import { useAudio } from "@/audio/hooks/useAudio";
import { resolveCompactLane } from "@/hooks/helpers/use-compact-hud";
import {
  type PopoverMapClick,
  type SurfaceAnchor,
  type SurfacePlacement,
  usePopoverStore,
} from "@/hooks/store/use-popover-store";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import type { LucideIcon } from "lucide-react";
import X from "lucide-react/dist/esm/icons/x";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const PANEL_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;
const HEADER_CLEARANCE_PX = 56;
/** Space the sheet keeps under its content so it clears the iOS home indicator; never less than the panel's padding. */
const COMPACT_SHEET_BOTTOM_INSET = "max(1rem, env(safe-area-inset-bottom))";
/** Keep in step with `max-lg:h-[85dvh]` in `SURFACE_WORKSPACE_CLASS`; Tailwind needs that class as a literal. */
const COMPACT_SHEET_CONTENT_HEIGHT = "85dvh";
/** The landscape drawer's width cap; keep in step with the `max-lg:landscape:w-[...]` in `SURFACE_WORKSPACE_CLASS`. */
const COMPACT_DRAWER_MAX_WIDTH = "min(100vw, 640px)";

/**
 * Size of a full workspace surface (Build, Military, Market...): a wide desk on desktop, a full bottom sheet below
 * `lg`, and a drawer down the right edge when the phone is sideways. The landscape height is the drawer's header
 * clearance (`HEADER_CLEARANCE_PX`, 3.5rem) plus its bottom inset (`COMPACT_SHEET_BOTTOM_INSET`), so the child
 * fits the drawer exactly; Tailwind needs the class as a literal, so keep the three in step.
 */
export const SURFACE_WORKSPACE_CLASS =
  "w-[1180px] h-[calc(100dvh-9rem)] max-lg:w-screen max-lg:h-[85dvh] max-lg:landscape:w-[min(60vw,640px)] max-lg:landscape:h-[calc(100dvh-3.5rem-max(1rem,env(safe-area-inset-bottom)))]";

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
  /** Against a rect anchor: under it, or beside it to the left with tops aligned (below when there is no room). */
  placement?: SurfacePlacement;
  className?: string;
  children: ReactNode;
  /** Escape or a pointer-down outside the panel (and outside its anchor) asks the owner to close it. */
  onDismiss: () => void;
  /** Map clicks may reanchor through the scene hit test; all other outside clicks dismiss. */
  mapClick?: PopoverMapClick;
  /** Pointer-downs inside the anchor are the trigger's own clicks, never an outside dismiss. */
  isInsideAnchor?: (target: EventTarget | null) => boolean;
  /** A desk the player can move: it opens where the last remembered desk was left. */
  rememberPosition?: boolean;
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
  placement = "below",
  className,
  children,
  onDismiss,
  isInsideAnchor = neverInsideAnchor,
  mapClick = "dismiss",
  rememberPosition = false,
}: PopoverPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const drag = useSurfaceDrag(rememberPosition);
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
    const place = () =>
      setPanelStyle(resolvePanelStyle(resolveAnchorRef.current(), align, placement, panelRef.current));
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [align, anchor, placement, Boolean(panelStyle)]);

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

    // Observe map touches before the canvas claims the navigation gesture.
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
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
        "pointer-events-auto fixed z-[130] w-80 touch-pan-y overflow-y-auto overscroll-contain rounded-xl p-4 text-gold",
        "max-lg:w-screen max-lg:rounded-b-none",
        "max-lg:landscape:w-auto max-lg:landscape:rounded-b-xl max-lg:landscape:rounded-r-none",
        OVERLAY_SURFACE_BASE,
        className,
      )}
      style={drag.apply(panelStyle)}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerUp}
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
      rememberPosition={surface.anchor === null}
      placement={surface.placement}
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

/** The header strip for a large surface: title, optional icon, close. Dragging it moves the surface. */
const PopoverHeader = ({ title, icon: Icon, onClose }: PopoverHeaderProps) => (
  <div
    data-popover-drag-handle
    className="flex cursor-move select-none touch-none items-center justify-between gap-2 border-b border-gold/15 px-4 py-2.5"
  >
    <span className={cn("flex items-center gap-2", HUD_LABEL_BRIGHT)}>
      {Icon && <Icon className="h-4 w-4 text-gold" />}
      {title}
    </span>
    <button
      type="button"
      onClick={onClose}
      className="inline-flex h-7 w-7 max-lg:h-11 max-lg:w-11 cursor-pointer items-center justify-center rounded-full border border-gold/30 bg-black/30 text-gold/80 transition hover:border-gold hover:bg-gold/15 hover:text-gold"
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
  /** Width and height of the surface, usually `SURFACE_WORKSPACE_CLASS`; the panel caps both to the viewport. */
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

/**
 * Where the panel sits. Below `lg` every anchor collapses: a phone has no room beside a trigger, so upright it is a
 * bottom sheet whose height budget is its content plus the safe-area strip, and sideways it is a drawer down the
 * right edge under the header, so a `SURFACE_WORKSPACE_CLASS` child fits exactly either way. Desktop placement
 * hangs from the anchor as before.
 */
const resolvePanelStyle = (
  anchor: PanelAnchor,
  align: PopoverAlign,
  placement: SurfacePlacement,
  panel: HTMLElement | null,
): CSSProperties => {
  const lane = resolveCompactLane();
  if (lane === "portrait") return resolveCompactSheetStyle();
  if (lane === "landscape") return resolveCompactDrawerStyle();
  if (placement === "beside" && typeof anchor !== "string") {
    return resolveBesidePanelStyle(anchor, panel) ?? resolveAnchoredPanelStyle(anchor, align, panel);
  }
  return resolveAnchoredPanelStyle(anchor, align, panel);
};

/**
 * Beside: the panel's right edge a gap left of the anchor's left edge, tops aligned, clamped to the viewport.
 * Null when the panel does not fit on the left, so the caller falls back to hanging below.
 */
const resolveBesidePanelStyle = (anchor: SurfaceAnchor, panel: HTMLElement | null): CSSProperties | null => {
  const panelWidth = panel?.offsetWidth ?? 0;
  const roomOnTheLeft = anchor.left - PANEL_GAP_PX - VIEWPORT_MARGIN_PX;
  if (panelWidth > roomOnTheLeft) return null;
  const contentHeight = panel?.scrollHeight ?? 0;
  const visibleHeight = Math.min(contentHeight, viewportHeightBelow(HEADER_CLEARANCE_PX));
  const top = Math.max(
    HEADER_CLEARANCE_PX,
    Math.min(anchor.top, window.innerHeight - visibleHeight - VIEWPORT_MARGIN_PX),
  );
  return {
    top,
    right: window.innerWidth - anchor.left + PANEL_GAP_PX,
    maxHeight: viewportHeightBelow(top),
    maxWidth: roomOnTheLeft,
  };
};

const resolveCompactSheetStyle = (): CSSProperties => ({
  left: 0,
  right: 0,
  bottom: 0,
  maxWidth: "100vw",
  maxHeight: `calc(${COMPACT_SHEET_CONTENT_HEIGHT} + ${COMPACT_SHEET_BOTTOM_INSET})`,
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
  paddingBottom: COMPACT_SHEET_BOTTOM_INSET,
});

const resolveCompactDrawerStyle = (): CSSProperties => ({
  top: HEADER_CLEARANCE_PX,
  right: 0,
  bottom: 0,
  maxWidth: COMPACT_DRAWER_MAX_WIDTH,
  maxHeight: `calc(100dvh - ${HEADER_CLEARANCE_PX}px)`,
  paddingRight: "env(safe-area-inset-right)",
  paddingBottom: COMPACT_SHEET_BOTTOM_INSET,
});

const resolveAnchoredPanelStyle = (
  anchor: PanelAnchor,
  align: PopoverAlign,
  panel: HTMLElement | null,
): CSSProperties => {
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
  const top = Math.max(
    HEADER_CLEARANCE_PX,
    Math.min(preferredTop, window.innerHeight - visibleHeight - VIEWPORT_MARGIN_PX),
  );
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

const FREE_SURFACE_OFFSET_KEY = "eternum.free-surface-offset";

/** Where the player last left a free-floating desk; every desk (Build, Production, Military, Transfer) opens there. */
const readFreeSurfaceOffset = (): { x: number; y: number } => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(FREE_SURFACE_OFFSET_KEY) ?? "null");
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return { x: stored.x, y: stored.y };
  } catch {
    // No stored position: the desk opens where it is placed.
  }
  return { x: 0, y: 0 };
};

const writeFreeSurfaceOffset = (offset: { x: number; y: number }): void => {
  try {
    window.localStorage.setItem(FREE_SURFACE_OFFSET_KEY, JSON.stringify(offset));
  } catch {
    // Storage refused: the position still holds for this open.
  }
};

/**
 * A surface with a header can be dragged by it. An anchored popover keeps its offset until it closes; a free desk
 * remembers where it was left and every free desk opens there.
 */
function useSurfaceDrag(isFreeSurface: boolean) {
  const [offset, setOffset] = useState(() => (isFreeSurface ? readFreeSurfaceOffset() : { x: 0, y: 0 }));
  const dragStart = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (!target.closest("[data-popover-drag-handle]") || target.closest("button,a,input,select,textarea")) return;
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, offsetX: offset.x, offsetY: offset.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const next = {
      x: start.offsetX + event.clientX - start.pointerX,
      y: start.offsetY + event.clientY - start.pointerY,
    };
    setOffset(next);
    if (isFreeSurface) writeFreeSurfaceOffset(next);
  };
  const onPointerUp = () => {
    dragStart.current = null;
  };
  const apply = (style: CSSProperties): CSSProperties =>
    offset.x === 0 && offset.y === 0
      ? style
      : { ...style, transform: [style.transform, `translate(${offset.x}px, ${offset.y}px)`].filter(Boolean).join(" ") };
  return { apply, onPointerDown, onPointerMove, onPointerUp };
}

const isInside = (target: EventTarget | null, element: HTMLElement | null): boolean =>
  element !== null && target instanceof Node && element.contains(target);
