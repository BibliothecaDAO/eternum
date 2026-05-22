import { cn } from "@/ui/design-system/atoms/lib/utils";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

interface CollapsibleBubbleProps {
  title: ReactNode;
  icon?: LucideIcon;
  cue?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /**
   * Suppress the chevron + click handler so the bubble functions as a plain
   * header card (e.g. the owner section, where there's nothing to hide).
   */
  static?: boolean;
}

/**
 * CollapsibleBubble — small standalone info bubble used on the right-edge
 * tile-details column. Click the header to toggle the body. Header stays
 * compact and consistent across bubbles; body content is provided by the
 * caller and only renders when expanded.
 */
export const CollapsibleBubble = ({
  title,
  icon: Icon,
  cue,
  defaultOpen = true,
  children,
  className,
  bodyClassName,
  static: isStatic = false,
}: CollapsibleBubbleProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const expanded = isStatic || isOpen;
  const HeaderTag = isStatic ? "div" : "button";

  return (
    <div
      className={cn(
        "pointer-events-auto rounded-2xl border border-gold/25 bg-black/85 shadow-lg shadow-black/40 backdrop-blur-sm",
        className,
      )}
    >
      <HeaderTag
        type={isStatic ? undefined : "button"}
        onClick={isStatic ? undefined : () => setIsOpen((value) => !value)}
        aria-expanded={isStatic ? undefined : isOpen}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left",
          !isStatic && "transition hover:text-gold cursor-pointer",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/80">
          {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 text-gold/70" />}
          <span className="truncate">{title}</span>
          {cue && <span className="flex-shrink-0 text-gold/55">{cue}</span>}
        </span>
        {!isStatic && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 flex-shrink-0 text-gold/60 transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        )}
      </HeaderTag>
      {expanded && <div className={cn("px-3 pb-3 pt-1", bodyClassName)}>{children}</div>}
    </div>
  );
};
