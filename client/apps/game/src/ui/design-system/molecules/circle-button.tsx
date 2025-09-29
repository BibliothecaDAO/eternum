import { useUISound } from "@/audio";
import { useUIStore } from "@/hooks/store/use-ui-store";
import clsx from "clsx";

type CircleButtonProps = {
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
  size: "xs" | "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  active?: boolean;
  label?: string;
  image?: string;
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
};

const notificationPositions = {
  topleft: "-top-1 -left-1",
  topright: "-top-1 right-0 -translate-x-1",
  bottomleft: "-bottom-1 -left-1",
  bottomright: "-bottom-1 right-0 -translate-x-1",
};

type NotificationColor = Exclude<
  NonNullable<CircleButtonProps["primaryNotification"]>["color"],
  undefined
>;

const notificationToneStyles: Record<NotificationColor, {
  background: string;
  border: string;
  text: string;
  shadow: string;
}> = {
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
  tooltipLocation = "bottom",
  primaryNotification,
  secondaryNotification,
  ...props
}: CircleButtonProps) => {
  const playHoverClick = useUISound("ui.hover");
  const playClick = useUISound("ui.click");
  const setTooltip = useUIStore((state) => state.setTooltip);

  const handleMouseEnter = () => {
    playHoverClick();
    if (label) {
      setTooltip({
        position: tooltipLocation,
        content: <span className="whitespace-nowrap pointer-events-none text-xs md:text-base">{label}</span>,
      });
    }
  };

  const handleClick = () => {
    if (!disabled) {
      onClick();
      playClick();
    }
  };

  return (
    <div className="relative">
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
        className={clsx(
          "flex transition-all duration-150 cursor-pointer items-center justify-center fill-current text-gold hover:border-gold shadow-2xl group bg-hex-bg hover:bg-gold border border-gold/40 button-wood",
          active ? "bg-gold !border-gold sepia-0" : "bg-dark-wood",
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
            "absolute animate-bounce rounded-full border px-1.5 md:px-2 text-[0.6rem] md:text-xxs z-[100] font-bold transition-shadow duration-200",
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
            "absolute animate-bounce rounded-full border px-1.5 md:px-2 text-[0.6rem] md:text-xxs z-[100] font-bold transition-shadow duration-200",
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

export default CircleButton;
