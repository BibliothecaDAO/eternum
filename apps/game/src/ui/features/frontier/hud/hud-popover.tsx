import { useSystemBackCloses } from "@/ui/design-system/kit/sheet-closes";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";

const POPOVER_GAP = 8;

const useOpenPopover = create<{ open: string | null; surface: boolean }>(() => ({ open: null, surface: false }));

export const useSurfacePopoverShown = () => useOpenPopover((state) => state.open !== null && state.surface);
export const closeHudPopover = () => useOpenPopover.setState({ open: null, surface: false });

export const popoverAnchor = (trigger: Pick<DOMRect, "left" | "bottom" | "width">): { x: number; top: number } => ({
  x: Math.round(trigger.left + trigger.width / 2),
  top: Math.round(trigger.bottom + POPOVER_GAP),
});

export const HudPopoverRoot = createContext<{ node: HTMLElement | null; scale: number }>({ node: null, scale: 1 });

export const useHudPopover = ({ surface = false }: { surface?: boolean } = {}) => {
  const root = useContext(HudPopoverRoot);
  const id = useId();
  const open = useOpenPopover((state) => state.open === id);
  const trigger = useRef<HTMLButtonElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const close = useCallback(
    () => useOpenPopover.setState((state) => (state.open === id ? { open: null, surface: false } : state)),
    [id],
  );
  const anchor = useTriggerAnchor(trigger, open, root.scale);
  useClosesOnPressOutside(open, close, trigger, layer);
  useEffect(() => {
    return close;
  }, [close]);
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
    trigger.current?.focus();
  };
  const triggerProps = {
    ref: trigger,
    "aria-expanded": open,
    "aria-controls": open ? id : undefined,
    onClick: () => useOpenPopover.setState(open ? { open: null, surface: false } : { open: id, surface }),
    onKeyDown: closeOnEscape,
  };
  const popover = (children: ReactNode, attributes: { className: string; layout?: string }) =>
    open &&
    createPortal(
      <PopoverLayer id={id} layer={layer} anchor={anchor} onClose={close} onKeyDown={closeOnEscape} {...attributes}>
        {children}
      </PopoverLayer>,
      root.node ?? document.body,
    );
  return { open, close, triggerProps, popover };
};

const PopoverLayer = ({
  id,
  layer,
  anchor,
  className,
  layout,
  onClose,
  onKeyDown,
  children,
}: {
  id: string;
  layer: RefObject<HTMLDivElement>;
  anchor: { x: number; top: number } | null;
  className: string;
  layout?: string;
  onClose: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  children: ReactNode;
}) => {
  useSystemBackCloses(onClose);
  useEffect(() => {
    layer.current?.focus({ preventScroll: true });
  }, [layer]);
  const style = anchor
    ? ({ "--popover-x": `${anchor.x}px`, "--popover-top": `${anchor.top}px` } as CSSProperties)
    : undefined;
  return (
    <div
      ref={layer}
      id={id}
      tabIndex={-1}
      data-hud-popover=""
      data-layout={layout}
      className={`ui frontier-popover pointer-events-auto ${className}`}
      style={style}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
};

const useTriggerAnchor = (trigger: RefObject<HTMLElement>, open: boolean, scale: number) => {
  const [anchor, setAnchor] = useState<{ x: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    const update = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const { x, top } = popoverAnchor(rect);
      setAnchor({ x: x / scale, top: top / scale });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, trigger, scale]);
  return anchor;
};

const useClosesOnPressOutside = (
  open: boolean,
  close: () => void,
  trigger: RefObject<HTMLElement>,
  layer: RefObject<HTMLElement>,
) => {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !layer.current?.contains(target)) close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close, trigger, layer]);
};
