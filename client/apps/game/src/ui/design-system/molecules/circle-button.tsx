import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
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
  topright: "-top-1 -right-1",
  bottomleft: "-bottom-1 -left-1",
  bottomright: "-bottom-1 -right-1",
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
  const { play: hoverClick } = useUiSounds(soundSelector.hoverClick);
  const { play: playClick } = useUiSounds(soundSelector.click);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const handleMouseEnter = () => {
    hoverClick();
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
            "absolute animate-bounce rounded-full border",
            `border-${primaryNotification.color || "green"}`,
            `bg-${primaryNotification.color || "green"}`,
            "text-brown px-1.5 md:px-2 text-[0.6rem] md:text-xxs z-[100] font-bold",
            notificationPositions[primaryNotification.location || "topleft"],
          )}
        >
          {primaryNotification.value}
        </div>
      )}
      {secondaryNotification && secondaryNotification.value > 0 && !disabled && (
        <div
          className={clsx(
            "absolute animate-bounce rounded-full border",
            `border-${secondaryNotification.color || "blue"}`,
            `bg-${secondaryNotification.color || "blue"}`,
            "text-brown px-1.5 md:px-2 text-[0.6rem] md:text-xxs z-[100] font-bold",
            notificationPositions[secondaryNotification.location || "topright"],
          )}
        >
          {secondaryNotification.value}
        </div>
      )}
    </div>
  );
};

export default CircleButton;
