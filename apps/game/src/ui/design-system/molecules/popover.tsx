import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { useAudio } from "@/audio/hooks/useAudio";
import { resolveCompactLane, useCompactLane } from "@/hooks/helpers/use-compact-hud";
import {
  type PopoverMapClick,
  type SurfaceAnchor,
  type SurfacePlacement,
  usePopoverStore,
} from "@/hooks/store/use-popover-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudIconButton } from "@/ui/design-system/kit/hud-elements";

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
/** Portrait sheets use at most 85% of the screen; the keyboard can reduce the content height further. */
const COMPACT_SHEET_CONTENT_HEIGHT = "85dvh";
/** The landscape drawer's width cap; keep in step with the workspace drawer width in hud-sheet.css. */
const COMPACT_DRAWER_MAX_WIDTH = "min(100vw, 640px)";

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
}

const neverInsideAnchor = () => false;

/**
 * The one panel: portaled to the body, capped to the viewport, closed by Escape or a pointer-down outside. It is
 * store-free — whoever mounts it owns its open state — so a view-driven surface (the sidebar's Build, Military,
 * Logistics and Chat), a store popover and a store surface all render through exactly this.
 *
 * A surface's life is its id: a panel that goes on to show another surface (Production replaced by the leaderboard,
 * Build by Military) starts afresh, placed by the rule and undragged. The same surface aimed again (another tile for
 * the same order) stays where the player left it.
 */
export const PopoverPanel = (props: PopoverPanelProps) => <OpenPanel key={props.id} {...props} />;

const OpenPanel = ({
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
}: PopoverPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  // A HUD window draws its own surface, bar and size; the panel then only places it, drags it and closes it.
  const [holdsWindow, setHoldsWindow] = useState(false);
  const lane = useCompactLane();
  const drag = useSurfaceDrag(lane === null);
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
    const place = () => {
      setHoldsWindow(isHudWindow(panelRef.current));
      setPanelStyle(resolvePanelStyle(resolveAnchorRef.current(), align, placement, panelRef.current));
    };
    place();
    // Content that grows or shrinks after opening (data arriving) moves a centred modal and a popover's fit.
    const content = panelRef.current?.firstElementChild;
    const contentResize = content && typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    if (content) contentResize?.observe(content);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      contentResize?.disconnect();
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [align, anchor, placement, lane, Boolean(panelStyle)]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-popover-anchor]")?.getAttribute("data-popover-anchor") === id
      )
        return;
      if (isInsideAnchorRef.current(event.target) || isInside(event.target, panelRef.current)) return;
      if (isOpenedFrom(event.target, panelRef.current)) return;
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
  }, [id]);

  useEffect(() => {
    if (!panelStyle) return;
    const previousFocus = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected &&
        (document.activeElement === document.body || panelRef.current?.contains(document.activeElement))
      ) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [id, Boolean(panelStyle)]);

  if (!panelStyle) return null;

  return createPortal(
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label={ariaLabel}
      data-popover-panel={id}
      className={cn(
        "pointer-events-auto fixed z-hud-popover touch-pan-y overflow-y-auto outline-none overscroll-contain",
        !holdsWindow && [
          "ui ui-popover w-80 rounded-xl p-4",
          "max-lg:w-screen max-lg:rounded-b-none",
          "max-lg:landscape:w-auto max-lg:landscape:rounded-b-xl max-lg:landscape:rounded-r-none",
          className,
        ],
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
 * same panel: a popover hangs from the rect it was opened at (or the top centre when it has none), a full modal stands
 * in the middle of the screen. Mounted once in the HUD.
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
  icon?: IconMeaning;
  onClose: () => void;
}

/**
 * A large surface's frame, in the HUD sheet's window: its bar (title, painting, close; dragging it moves the surface)
 * over a scrolling body, with an optional foot. It is a full modal, and the panel draws no box of its own around it.
 */
export const SurfaceFrame = ({
  title,
  icon,
  onClose,
  footer,
  className,
  bodyClassName,
  children,
}: SurfaceFrameProps) => (
  <section data-surface-frame className={cn("ui ui-window max-w-full min-h-0", className)}>
    <header className="ui-window__bar" data-popover-drag-handle>
      {icon && <Icon name={icon} size={22} />}
      <span>{title}</span>
      <HudIconButton icon="close" label="Close" kind="quiet" onClick={onClose} />
    </header>
    <div className={cn("ui-window__body", bodyClassName)}>{children}</div>
    {footer && <footer className="ui-window__foot ui-actions">{footer}</footer>}
  </section>
);

interface SurfaceFrameProps {
  title: ReactNode;
  icon?: IconMeaning;
  onClose: () => void;
  footer?: ReactNode;
  /** Width and height of the surface, usually the sheet's workspace class; the panel caps both to the viewport. */
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** The rect a surface should hang from when a button opens it. */
export const surfaceAnchorFrom = (element: Element): SurfaceAnchor => {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
};

/**
 * Where the panel sits. Below `lg` every anchor collapses: a phone has no room beside a trigger, so upright it is a
 * bottom sheet whose height budget is its content plus the safe-area strip, and sideways it is a drawer down the
 * right edge under the header, so a workspace-sized child fits exactly either way. On desktop a full modal
 * stands in the middle of the screen, wherever it was opened from (a tile, a button), unless it is set against a side
 * of the screen; a small popover hangs from its anchor.
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
  if (isFullModal(panel) && !isSideEdge(anchor)) return resolveCentredPanelStyle(panel);
  if (placement === "beside" && typeof anchor !== "string") {
    return resolveBesidePanelStyle(anchor, panel) ?? resolveAnchoredPanelStyle(anchor, align, panel);
  }
  return resolveAnchoredPanelStyle(anchor, align, panel);
};

/** A HUD window (HudWindow) in the panel: it brings its own surface, bar and size. */
const isHudWindow = (panel: HTMLElement | null): boolean => panel?.querySelector(":scope > .ui-window") != null;

/** A full modal is a HUD window or a `SurfaceFrame`; anything else in a panel is a small popover. */
const isFullModal = (panel: HTMLElement | null): boolean =>
  isHudWindow(panel) || panel?.querySelector(":scope > [data-surface-frame]") != null;

const isSideEdge = (anchor: PanelAnchor): boolean => anchor === "right-edge" || anchor === "bottom-right";

/** In the middle of the screen below the header, as far as its height allows. */
const resolveCentredPanelStyle = (panel: HTMLElement | null): CSSProperties => {
  const room = viewportHeightBelow(HEADER_CLEARANCE_PX);
  const top = HEADER_CLEARANCE_PX + Math.max(0, (room - (panel?.scrollHeight ?? 0)) / 2);
  return {
    top,
    left: "50%",
    transform: "translateX(-50%)",
    maxHeight: viewportHeightBelow(top),
    maxWidth: Math.max(0, window.innerWidth - 2 * VIEWPORT_MARGIN_PX),
  };
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

/** The visual viewport excludes the keyboard, unlike the layout viewport on mobile Safari. */
const compactViewportStyle = (): CSSProperties => {
  const viewport = window.visualViewport;
  return {
    "--surface-viewport-height": `${viewport?.height ?? window.innerHeight}px`,
    bottom: viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0,
  } as CSSProperties;
};

// A portrait screen has no side insets, so the sides keep the panel's own padding: set here, zero would replace it.
const resolveCompactSheetStyle = (): CSSProperties => ({
  left: 0,
  right: 0,
  ...compactViewportStyle(),
  maxWidth: "100vw",
  maxHeight: `min(calc(${COMPACT_SHEET_CONTENT_HEIGHT} + ${COMPACT_SHEET_BOTTOM_INSET} + 2px), var(--surface-viewport-height, 100dvh))`,
  paddingBottom: COMPACT_SHEET_BOTTOM_INSET,
});

const resolveCompactDrawerStyle = (): CSSProperties => ({
  ...compactViewportStyle(),
  top: (window.visualViewport?.offsetTop ?? 0) + HEADER_CLEARANCE_PX,
  right: 0,
  maxWidth: COMPACT_DRAWER_MAX_WIDTH,
  maxHeight: `calc(var(--surface-viewport-height, 100dvh) - ${HEADER_CLEARANCE_PX}px)`,
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

/**
 * A surface with a header can be dragged by it while it is open; it opens where its placement puts it every time.
 */
function useSurfaceDrag(enabled: boolean) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const target = event.target as Element;
    if (!target.closest("[data-popover-drag-handle]") || target.closest("button,a,input,select,textarea")) return;
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, offsetX: offset.x, offsetY: offset.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!enabled || !start) return;
    const next = {
      x: start.offsetX + event.clientX - start.pointerX,
      y: start.offsetY + event.clientY - start.pointerY,
    };
    setOffset(next);
  };
  const onPointerUp = () => {
    dragStart.current = null;
  };
  const apply = (style: CSSProperties): CSSProperties =>
    !enabled || (offset.x === 0 && offset.y === 0)
      ? style
      : { ...style, transform: [style.transform, `translate(${offset.x}px, ${offset.y}px)`].filter(Boolean).join(" ") };
  return { apply, onPointerDown, onPointerMove, onPointerUp };
}

const isInside = (target: EventTarget | null, element: HTMLElement | null): boolean =>
  element !== null && target instanceof Node && element.contains(target);

/**
 * A layer drawn over every surface (a select's list) belongs to the panel whose control opened it, named by that
 * control's `aria-controls`: a press on it is inside, never an outside dismiss.
 */
const isOpenedFrom = (target: EventTarget | null, element: HTMLElement | null): boolean => {
  if (element === null) return false;
  const opened = new Set([...element.querySelectorAll("[aria-controls]")].map((c) => c.getAttribute("aria-controls")));
  for (let node = target instanceof Element ? target : null; node !== null; node = node.parentElement) {
    if (node.id && opened.has(node.id)) return true;
  }
  return false;
};
