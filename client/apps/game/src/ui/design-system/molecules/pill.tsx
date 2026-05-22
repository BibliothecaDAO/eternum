import { cn } from "@/ui/design-system/atoms/lib/utils";
import { forwardRef, type ReactNode } from "react";

export type PillTone = "default" | "gold" | "danger" | "warning" | "success" | "info";

interface PillDot {
  className?: string;
  pulse?: boolean;
}

interface CommonPillProps {
  show?: boolean;
  tone?: PillTone;
  active?: boolean;
  dot?: PillDot;
  className?: string;
  title?: string;
  "aria-label"?: string;
  children: ReactNode;
}

interface InteractivePillProps extends CommonPillProps {
  onClick: () => void;
  disabled?: boolean;
}

interface StaticPillProps extends CommonPillProps {
  onClick?: undefined;
}

type PillProps = InteractivePillProps | StaticPillProps;

const toneClasses: Record<PillTone, { container: string; dot: string }> = {
  default: {
    container: "border-gold/30 bg-black/55 text-gold/85 hover:border-gold/50 hover:text-gold",
    dot: "bg-gold/80",
  },
  gold: {
    container: "border-gold/60 bg-gold/15 text-gold shadow-[inset_0_1px_0_rgba(255,214,102,0.18)]",
    dot: "bg-gold",
  },
  danger: {
    container: "border-danger/60 bg-danger/15 text-danger hover:bg-danger/25",
    dot: "bg-danger",
  },
  warning: {
    container: "border-orange/60 bg-orange/15 text-orange hover:bg-orange/25",
    dot: "bg-orange",
  },
  success: {
    container: "border-emerald-400/60 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20",
    dot: "bg-emerald-400",
  },
  info: {
    container: "border-cyan-300/45 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20",
    dot: "bg-cyan-300",
  },
};

const baseClasses =
  "relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors";

/**
 * Pill — the shared shell for floating top-zone widgets.
 *
 * Visual contract follows NetworkStatusPill so all overlay pills look like one
 * family. Returns null when `show === false` so a pill can be its own reveal
 * gate. Renders as a button when `onClick` is set, otherwise as a div.
 */
export const Pill = forwardRef<HTMLElement, PillProps>(
  ({ show = true, tone = "default", active, dot, className, title, "aria-label": ariaLabel, children, ...rest }, ref) => {
    if (!show) return null;

    const resolvedTone = active && tone === "default" ? "gold" : tone;
    const palette = toneClasses[resolvedTone];

    const renderedDot = dot ? (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-2 w-2 rounded-full shadow-[0_0_6px_currentColor]",
          dot.className ?? palette.dot,
          dot.pulse && "animate-pulse",
        )}
      />
    ) : null;

    const sharedProps = {
      className: cn(baseClasses, palette.container, className),
      title,
      "aria-label": ariaLabel,
    };

    if ("onClick" in rest && rest.onClick) {
      const { onClick, disabled } = rest as InteractivePillProps;
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          type="button"
          onClick={onClick}
          disabled={disabled}
          {...sharedProps}
          className={cn(
            sharedProps.className,
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/45",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {renderedDot}
          {children}
        </button>
      );
    }

    return (
      <div ref={ref as React.Ref<HTMLDivElement>} {...sharedProps}>
        {renderedDot}
        {children}
      </div>
    );
  },
);

Pill.displayName = "Pill";
