import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import type { LucideIcon } from "lucide-react";
import X from "lucide-react/dist/esm/icons/x";
import { type ReactNode, useEffect } from "react";

interface CenteredModalShellProps {
  title: ReactNode;
  icon?: LucideIcon;
  onClose: () => void;
  /**
   * "default" → 840×680 (Chat / Logistics / Prediction Market — these need
   * room for tabs and lists, smaller felt cramped in user testing).
   * "wide" → 920×700 (the Create Field Army reference shape — Military and
   * any sidebar-style modal that wants a touch more horizontal room).
   * "xl" → 1320×calc(100vh-48px) (Production / Construction need the canvas).
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
 * One shell, one design language. Every centered HUD modal renders through
 * this component so the backdrop, bronze frame, header strip and close
 * button are the same everywhere. Consumers only fill the body.
 *
 * Behavior:
 *  - Backdrop dims the world + click-outside dismiss.
 *  - Escape closes.
 *  - Inside-click stops propagation so chrome doesn't dismiss when the user
 *    interacts with the modal body.
 */
export const CenteredModalShell = ({
  title,
  icon: Icon,
  onClose,
  size = "default",
  bodyClassName,
  children,
}: CenteredModalShellProps) => {
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 pointer-events-auto"
      onClick={onClose}
    >
      <div
        className={cn(
          "pointer-events-auto flex flex-col overflow-hidden rounded-xl",
          sizeClass,
          OVERLAY_SURFACE_BASE,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gold/15 px-4 py-2.5">
          <span className={cn("flex items-center gap-2", HUD_LABEL_BRIGHT)}>
            {Icon && <Icon className="h-4 w-4 text-gold" />}
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gold/30 bg-black/30 text-gold/80 transition hover:border-gold hover:bg-gold/15 hover:text-gold"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={cn("flex-1 min-h-0", bodyClassName ?? "overflow-hidden")}>{children}</div>
      </div>
    </div>
  );
};

CenteredModalShell.displayName = "CenteredModalShell";
