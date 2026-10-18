import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type ReactNode, useContext } from "react";

import { OpenedFromPanel } from "./opened-from-panel";
import { SheetHandle, useSheetCloses } from "./sheet-closes";
import { BACK, CLOSE } from "./words";

/** Where a desktop sheet docks: under the match's bar, or on an app page's right under its title (under the top bar). */
const DESKTOP_PLACEMENT = {
  bar: "lg:right-2 lg:top-[76px] lg:max-h-[calc(100dvh-84px)]",
  page: "lg:right-8 lg:top-[168px] lg:max-h-[calc(100dvh-192px)]",
} as const;

/**
 * The kit's sheet: a bottom sheet on a phone; on a desktop a panel docked in the leaderboard's place under the bar (or,
 * placed on a page, at the page's right under its title, clear of the notice), as tall as its content, with no handle. It closes from its handle (a tap or a drag down) or a tap on
 * the stage behind it on a phone, from its mark on a desktop (a cross, or a back arrow when it opened from another
 * panel), and from Escape or the system back on both. A desktop stage stays playable beside the panel.
 */
export const Sheet = ({
  label,
  onClose,
  placement = "bar",
  children,
}: {
  label: string;
  onClose: () => void;
  placement?: keyof typeof DESKTOP_PLACEMENT;
  children: ReactNode;
}) => {
  const fromPanel = useContext(OpenedFromPanel);
  useSheetCloses(onClose);
  return (
    <>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="pointer-events-auto fixed inset-0 z-30 cursor-default lg:hidden"
      />
      <section
        role="dialog"
        aria-label={label}
        data-kit-sheet
        className={cn(
          // Visible even when the panel it opened from steps aside for it (HudBands hides that panel).
          "frontier-sheet pointer-events-auto visible fixed z-40 flex flex-col font-sans",
          "inset-x-0 bottom-0 max-h-[85dvh]",
          "lg:inset-x-auto lg:bottom-auto lg:w-[440px]",
          DESKTOP_PLACEMENT[placement],
        )}
      >
        <SheetHandle onClose={onClose}>
          <i className="frontier-handle" />
        </SheetHandle>
        <Mark back={fromPanel} onClose={onClose} />
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pt-3.5">
          {children}
        </div>
      </section>
    </>
  );
};

/** A desktop panel's own way out on its top edge: a cross, or a back arrow to the panel it opened from. */
const Mark = ({ back, onClose }: { back: boolean; onClose: () => void }) => (
  <button
    type="button"
    aria-label={back ? BACK : CLOSE}
    onClick={onClose}
    className={cn(
      "absolute -top-2.5 right-3.5 z-10 hidden size-8 items-center justify-center rounded-full border-[1.5px] border-kit-line2 bg-kit-ink shadow-mark hover:border-kit-gold lg:flex",
      !back &&
        "before:absolute before:h-[2.5px] before:w-3.5 before:rotate-45 before:rounded-sm before:bg-kit-gold before:content-[''] after:absolute after:h-[2.5px] after:w-3.5 after:-rotate-45 after:rounded-sm after:bg-kit-gold after:content-['']",
    )}
  >
    {back && <SemanticIcon name="arrow-left" size={20} />}
  </button>
);
