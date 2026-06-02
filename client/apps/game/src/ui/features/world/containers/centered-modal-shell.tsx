import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { useDraggablePosition } from "@/ui/shared/lib/draggable-position";
import type { LucideIcon } from "lucide-react";
import X from "lucide-react/dist/esm/icons/x";
import { type ReactNode, useEffect } from "react";
import Draggable from "react-draggable";

interface CenteredModalShellProps {
  title: ReactNode;
  icon?: LucideIcon;
  onClose: () => void;
  /**
   * "compact" → content-sized small window, "default" → 840×680,
   * "wide" → 920×700, "xl" → 1320×calc(100vh-48px).
   * Bubble modals (Military, Build, Production, Chat, …) all use "xl" so they
   * share one window size; the smaller presets remain for incidental modals.
   */
  size?: "compact" | "default" | "wide" | "xl";
  /**
   * Optional override of the outer modal wrapper class. Body content can opt
   * out of the default vertical scroll if it manages its own layout (e.g.
   * production grid).
   */
  bodyClassName?: string;
  /**
   * Optional override merged after the size preset (via cn = clsx +
   * tailwind-merge), so e.g. `w-[360px] h-auto` cleanly overrides the preset
   * width/height for the narrow legacy windows.
   */
  panelClassName?: string;
  /**
   * localStorage key for drag-position persistence. When set, the window
   * re-opens at its last-dragged position; otherwise it opens centered.
   */
  persistKey?: string;
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
 *    clicks). Drag the window aside to keep it open while you work.
 *  - Closes via the ✕ button, Escape, or a click anywhere outside the panel.
 */
export const CenteredModalShell = ({
  title,
  icon: Icon,
  onClose,
  size = "default",
  bodyClassName,
  panelClassName,
  persistKey,
  children,
}: CenteredModalShellProps) => {
  const { nodeRef, position, onDrag, onStop } = useDraggablePosition(persistKey);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // Click-outside dismiss: the wrapper stays pointer-events-none so the world
    // behind remains interactive, so we listen at the document level and close
    // whenever a mousedown lands outside the panel.
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      // Dropdowns/selects/tooltips render in a portal at the document root
      // (outside the panel). Ignore clicks inside them so interacting with a
      // Select option doesn't dismiss the modal mid-interaction.
      if (target?.closest?.("[data-radix-popper-content-wrapper],[role='listbox'],[data-radix-portal]")) {
        return;
      }
      if (nodeRef.current && !nodeRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onClose]);

  const sizeClass =
    size === "xl"
      ? "w-[1320px] max-w-[calc(100vw-48px)] h-[calc(100vh-48px)]"
      : size === "wide"
        ? "w-[920px] max-w-[92vw] h-[700px] max-h-[calc(100vh-64px)]"
        : size === "compact"
          ? "w-[560px] max-w-[92vw] h-auto max-h-[calc(100vh-64px)]"
          : "w-[840px] max-w-[92vw] h-[680px] max-h-[calc(100vh-64px)]";

  return (
    // pointer-events-none lets clicks fall through to the world; only the panel
    // re-enables them. flex centering gives the draggable its starting origin.
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <Draggable
        handle=".modal-drag-handle"
        cancel=".modal-no-drag"
        bounds="parent"
        nodeRef={nodeRef}
        position={position}
        onDrag={onDrag}
        onStop={onStop}
      >
        <div
          ref={nodeRef}
          className={cn(
            "pointer-events-auto flex flex-col overflow-hidden rounded-xl",
            sizeClass,
            panelClassName,
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
