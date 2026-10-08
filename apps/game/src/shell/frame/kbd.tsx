import { cn } from "@/ui/design-system/atoms/lib/utils";

/** A key mark: the desktop's keyboard answer for the control beside it (1–4 the places, Esc Back). */
export const Kbd = ({ keyName, className }: { keyName: string; className?: string }) => (
  <kbd
    aria-hidden
    className={cn(
      "rounded-[5px] border border-b-2 border-kit-line2 bg-black/30 px-[5px] font-body text-[11px] font-bold leading-[1.4] text-kit-muted",
      className,
    )}
  >
    {keyName}
  </kbd>
);
