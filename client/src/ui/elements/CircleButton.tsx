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
  image?: string; // Added image prop
  tooltipLocation?: "top" | "bottom" | "left" | "right";
  notification?: number;
  notificationLocation?: "topleft" | "topright" | "bottomleft" | "bottomright";
} & React.ComponentPropsWithRef<"button">;

const sizes = {
  xs: "w-6 h-6 rounded-full",
  sm: "w-8 h-8 rounded-full",
  md: "w-10 h-10 rounded-full",
  lg: "w-12 h-12 rounded-full",
  xl: "w-16 h-16 rounded-xl",
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
  const setTooltip = useUIStore((state) => state.setTooltip);
  const { play: playClick } = useUiSounds(soundSelector.click);

  const notificationPositions = {
    topleft: "-top-1 -left-1",
    topright: "-top-1 -right-1",
    bottomleft: "-bottom-1 -left-1",
    bottomright: "-bottom-1 -right-1",
  };

  return (
    <div className="relative">
      <button
        onMouseEnter={() => {
          hoverClick();
          label &&
            setTooltip({
              position: tooltipLocation,
              content: <span className="whitespace-nowrap pointer-events-none">{label}</span>,
            });
        }}
        onMouseLeave={() => setTooltip(null)}
        onClick={() => {
          if (!disabled) {
            onClick();
            playClick();
          }
        }}
        className={clsx(
          "flex transition-all duration-150  cursor-pointer items-center justify-center fill-current text-gold hover:border-gold  shadow-2xl group  bg-hex-bg hover:bg-gold border-2 border-white/10",
          active ? "bg-gold" : "bg-black/90",
          className,
          sizes[size],
          { "cursor-not-allowed": disabled },
          { " !border-gold sepia-0 ": active },
          { " border-brown/30 sepia-[.50] ": !active },
        )}
        disabled={disabled}
        {...props}
      >
        {children}
        <div className={clsx()}>
          <img src={image} alt="icon" />
        </div>
        {disabled && <div className="absolute inset-0 bg-black opacity-50 rounded-full"></div>}
      </button>
      {notification && !disabled ? (
        <div
          className={clsx(
            "absolute animate-bounce rounded-full border border-green/30 bg-green/90 text-brown px-2 text-xxs z-[100] font-bold",
            notificationPositions[notificationLocation],
          )}
        >
          {notification}
        </div>
      ) : (
        <></>
      )}
    </div>
  );
};

export default CircleButton;
