import { useUISound } from "@/audio";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { OVERLAY_SURFACE_ACTIVE, OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import clsx from "clsx";
import { memo, useCallback, useMemo } from "react";

type CircleButtonProps = {
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
  size: "xs" | "sm" | "md" | "lg" | "xl" | "topbar";
  disabled?: boolean;
  active?: boolean;
  label?: string;
  image?: string;
  /**
   * "default" keeps the legacy wooden chrome (modals, in-panel uses).
   * "hud" applies the shared Etched Bronze HUD surface so view-switcher
   * + alert-cluster icons feel like part of the same family as pills.
   */
  variant?: "default" | "hud";
  tooltipLocation?: "top" | "bottom" | "left" | "right";
  primaryNotification?: {
    value: number;
    color?: "green" | "red" | "blue" | "yellow" | "gold" | "orange";
    location?: "topleft" | "topright" | "bottomleft" | "bottomright";
  };
  secondaryNotification?: {
    value: number;
    color?: "green" | "red" | "blue" | "yellow" | "gold" | "orange";
    location?: "topleft" | "topright" | "bottomleft" | "bottomright";
  };
} & React.ComponentPropsWithRef<"button">;

const sizes = {
  xs: "w-6 h-6 md:w-6 md:h-6 rounded-full",
  sm: "w-7 h-7 md:w-8 md:h-8 rounded-full",
  md: "w-8 h-8 md:w-10 md:h-10 rounded-full",
  lg: "w-10 h-10 md:w-12 md:h-12 rounded-full",
  xl: "w-12 h-12 md:w-16 md:h-16 rounded-xl",
  // Fixed h-9 / w-9 to align with the h-9 pills in the top bar (TOP_PILL).
  topbar: "w-9 h-9 rounded-full",
};

const notificationPositions = {
  topleft: "-top-0.5 -left-0.5",
  topright: "-top-0.5 -right-0.5",
  bottomleft: "-bottom-0.5 -left-0.5",
  bottomright: "-bottom-0.5 -right-0.5",
};

type NotificationColor = Exclude<NonNullable<CircleButtonProps["primaryNotification"]>["color"], undefined>;

const notificationToneStyles: Record<
  NotificationColor,
  {
    background: string;
    border: string;
    text: string;
    shadow: string;
  }
> = {
  green: {
    background: "bg-progress-bar-good/90",
    border: "border-progress-bar-good/80",
    text: "text-dark",
    shadow: "shadow-[0_0_10px_rgba(16,185,129,0.45)]",
  },
  red: {
    background: "bg-progress-bar-danger/90",
    border: "border-progress-bar-danger/80",
    text: "text-lightest",
    shadow: "shadow-[0_0_10px_rgba(239,68,68,0.4)]",
  },
  blue: {
    background: "bg-blueish/90",
    border: "border-blueish/80",
    text: "text-lightest",
    shadow: "shadow-[0_0_10px_rgba(107,127,215,0.4)]",
  },
  yellow: {
    background: "bg-yellow/90",
    border: "border-yellow/80",
    text: "text-dark",
    shadow: "shadow-[0_0_10px_rgba(250,255,0,0.45)]",
  },
  gold: {
    background: "bg-gold/90",
    border: "border-gold/80",
    text: "text-dark",
    shadow: "shadow-[0_0_10px_rgba(223,170,84,0.45)]",
  },
  orange: {
    background: "bg-orange/90",
    border: "border-orange/80",
    text: "text-dark",
    shadow: "shadow-[0_0_10px_rgba(254,153,60,0.45)]",
  },
};

const getToneClasses = (color: NotificationColor | undefined, fallback: NotificationColor) => {
  const tone = notificationToneStyles[color ?? fallback];
  return clsx(tone.background, tone.border, tone.text, tone.shadow);
};

const CircleButton = ({
  onClick,
  children,
  className,
  size,
  disabled,
  active,
  label,
  image,
  variant = "default",
  tooltipLocation = "bottom",
  primaryNotification,
  secondaryNotification,
  ...props
}: CircleButtonProps) => {
  const playHoverClick = useUISound("ui.hover");
  const playClick = useUISound("ui.click");
  const setTooltip = useUIStore((state) => state.setTooltip);

  const tooltipContent = useMemo(
    () => (label ? <span className="whitespace-nowrap pointer-events-none text-xs md:text-base">{label}</span> : null),
    [label],
  );

  const handleMouseEnter = useCallback(() => {
    playHoverClick();
    if (tooltipContent) {
      setTooltip({
        position: tooltipLocation,
        content: tooltipContent,
      });
    }
  }, [playHoverClick, setTooltip, tooltipContent, tooltipLocation]);

  const handleMouseLeave = useCallback(() => setTooltip(null), [setTooltip]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      onClick();
      playClick();
    }
  }, [disabled, onClick, playClick]);

  return (
    <div className="relative">
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={clsx(
          "flex cursor-pointer items-center justify-center fill-current text-gold group",
          variant === "hud"
            ? clsx(OVERLAY_SURFACE_BASE, !disabled && "hover:border-gold/55", active && !disabled && OVERLAY_SURFACE_ACTIVE)
            : clsx(
                "transition-all duration-150 hover:border-gold shadow-2xl bg-hex-bg hover:bg-gold border border-gold/40 button-wood",
                active ? "bg-gold !border-gold sepia-0" : "bg-dark-wood",
              ),
          // Hover/active grow — makes the icons feel tactile and emphasizes the
          // current selection without changing layout. Disabled icons stay flat.
          !disabled && "hover:scale-110 active:scale-95",
          active && !disabled && variant !== "hud" && "scale-110 ring-2 ring-gold/40 shadow-[0_0_18px_rgba(223,170,84,0.45)]",
          active && !disabled && variant === "hud" && "scale-110",
          className,
          sizes[size],
          { "cursor-not-allowed": disabled },
        )}
        disabled={disabled}
        {...props}
      >
        {children}
        {image && (
          <div className="w-full h-full">
            <img className="p-1.5 w-full h-full object-contain" src={image} alt="icon" />
          </div>
        )}
        {disabled && <div className="absolute inset-0 bg-brown opacity-50 rounded-full"></div>}
      </button>
      {primaryNotification && primaryNotification.value > 0 && !disabled && (
        <div
          className={clsx(
            "absolute min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full border text-[9px] leading-none z-[100] font-bold animate-bounce transition-shadow duration-200",
            notificationPositions[primaryNotification.location || "topleft"],
            getToneClasses(primaryNotification.color, "green"),
          )}
        >
          {primaryNotification.value}
        </div>
      )}
      {secondaryNotification && secondaryNotification.value > 0 && !disabled && (
        <div
          className={clsx(
            "absolute min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full border text-[9px] leading-none z-[100] font-bold animate-bounce transition-shadow duration-200",
            notificationPositions[secondaryNotification.location || "topright"],
            getToneClasses(secondaryNotification.color, "blue"),
          )}
        >
          {secondaryNotification.value}
        </div>
      )}
    </div>
  );
};

export default memo(CircleButton);
