import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
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
  notification?: number;
  notificationLocation?: "topleft" | "topright" | "bottomleft" | "bottomright";
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
  notification,
  notificationLocation = "topleft",
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
          "flex transition-all duration-150 cursor-pointer items-center justify-center fill-current text-gold hover:border-gold shadow-2xl group bg-hex-bg hover:bg-gold border border-white/10",
          active ? "bg-gold !border-gold sepia-0" : "bg-brown/90 border-brown/30",
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
            <img className="p-1 w-full h-full object-contain" src={image} alt="icon" />
          </div>
        )}
        {disabled && <div className="absolute inset-0 bg-brown opacity-50 rounded-full"></div>}
      </button>
      {notification && !disabled ? (
        <div
          className={clsx(
            "absolute animate-bounce rounded-full border border-green/30 bg-green/90 text-brown px-1.5 md:px-2 text-[0.6rem] md:text-xxs z-[100] font-bold",
            notificationPositions[notificationLocation],
          )}
        >
          {notification}
        </div>
      ) : (
        ""
      )}
    </div>
  );
};

export default CircleButton;
