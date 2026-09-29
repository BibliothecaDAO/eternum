import { X } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type ReactNode, useEffect } from "react";

import { useWorkspaceTakesScreen } from "./use-workspace-takes-screen";

const WIDTHS = { md: "landscape:w-[min(560px,70vw)]", lg: "landscape:w-[min(760px,80vw)]" } as const;

/**
 * Frontier's one sheet: a bottom sheet on a phone held upright, a card at the foot of the screen otherwise, capped at
 * 85% of the screen with its body scrolling. It closes from its own close button, on Escape, and on a tap outside it.
 * A workspace (deploy, research, the season board) also takes the screen, so opening one closes the other.
 */
export const FrontierSheet = ({
  label,
  onClose,
  workspace = false,
  width = "md",
  bodyClassName,
  children,
}: {
  label: string;
  onClose: () => void;
  workspace?: boolean;
  width?: keyof typeof WIDTHS;
  /** The body's layout, where a sheet arranges its own header, scroller and footer. */
  bodyClassName?: string;
  children: ReactNode;
}) => {
  useEscapeCloses(onClose);
  return (
    <>
      {/* The world under the sheet: a tap there closes it. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="pointer-events-auto fixed inset-0 z-30 cursor-default"
      />
      <section
        aria-label={label}
        data-frontier-sheet
        className={cn(
          "frontier-sheet pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col font-sans",
          "landscape:inset-x-auto landscape:bottom-4 landscape:left-1/2 landscape:-translate-x-1/2",
          WIDTHS[width],
        )}
      >
        {workspace && <TakesScreen close={onClose} />}
        <div className="flex justify-end px-2 pt-2">
          <SheetClose onClose={onClose} />
        </div>
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </section>
    </>
  );
};

/** The one close control of every Frontier sheet and panel: an ✕ on the chip token, top right. */
export const SheetClose = ({
  onClose,
  label = "Close",
  disabled = false,
}: {
  onClose: () => void;
  label?: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClose}
    className="frontier-chip pointer-events-auto size-10 justify-center !p-0 hover:border-[#6b5230] disabled:opacity-40"
  >
    <X className="!size-5" />
  </button>
);

/** A workspace's hold on the screen, mounted with its sheet. */
const TakesScreen = ({ close }: { close: () => void }) => {
  useWorkspaceTakesScreen(close);
  return null;
};

export const useEscapeCloses = (close: () => void) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
};
