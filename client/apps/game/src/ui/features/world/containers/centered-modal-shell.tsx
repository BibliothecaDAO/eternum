import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import type { LucideIcon } from "lucide-react";
import X from "lucide-react/dist/esm/icons/x";
import { type ReactNode, useEffect, useRef } from "react";
import Draggable from "react-draggable";

interface CenteredModalShellProps {
  title: ReactNode;
  icon?: LucideIcon;
  onClose: () => void;
  /**
   * "default" → 840×680, "wide" → 920×700, "xl" → 1320×calc(100vh-48px).
   * Bubble modals (Military, Build, Production, Chat, …) all use "xl" so they
   * share one window size; the smaller presets remain for incidental modals.
   */
  size?: "default" | "wide" | "xl";
  /**
   * Optional override of the outer modal wrapper class. Body content can opt
   * out of the default vertical scroll if it manages its own layout (e.g.
   * production grid).
   */
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * One shell, one design language. Every HUD modal renders through this
 * component so the bronze frame, header strip and close button are the same
 * everywhere. Consumers only fill the body.
 *
 * Behavior — a real, movable window (matching the Create Field Army popup):
 *  - Draggable by its header; opens centered, stays within the viewport.
 *  - NO dimming backdrop — the world behind stays fully interactive (the
 *    full-screen wrapper is pointer-events-none; only the panel captures
 *    clicks). Drag the window aside instead of dismissing it.
 *  - Closes via the ✕ button or Escape (no click-outside dismiss).
 */
export const CenteredModalShell = ({
  title,
  icon: Icon,
  onClose,
  size = "default",
  bodyClassName,
  children,
}: CenteredModalShellProps) => {
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const sizeClass =
    size === "xl"
      ? "w-[1320px] max-w-[calc(100vw-48px)] h-[calc(100vh-48px)]"
      : size === "wide"
        ? "w-[920px] max-w-[92vw] h-[700px] max-h-[calc(100vh-64px)]"
        : "w-[840px] max-w-[92vw] h-[680px] max-h-[calc(100vh-64px)]";

  return (
    // pointer-events-none lets clicks fall through to the world; only the panel
    // re-enables them. flex centering gives the draggable its starting origin.
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <Draggable handle=".modal-drag-handle" cancel=".modal-no-drag" bounds="parent" nodeRef={nodeRef}>
        <div
          ref={nodeRef}
          className={cn(
            "pointer-events-auto flex flex-col overflow-hidden rounded-xl",
            sizeClass,
            OVERLAY_SURFACE_BASE,
          )}
        >
          <div className="modal-drag-handle flex cursor-move items-center justify-between gap-2 border-b border-gold/15 px-4 py-2.5">
            <span className={cn("flex items-center gap-2", HUD_LABEL_BRIGHT)}>
              {Icon && <Icon className="h-4 w-4 text-gold" />}
              {title}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="modal-no-drag inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-gold/30 bg-black/30 text-gold/80 transition hover:border-gold hover:bg-gold/15 hover:text-gold"
              aria-label="Close"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className={cn("flex-1 min-h-0", bodyClassName ?? "overflow-hidden")}>{children}</div>
        </div>
      </Draggable>
    </div>
  );
};

CenteredModalShell.displayName = "CenteredModalShell";
