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
} & React.ComponentPropsWithRef<"button">;

const sizes = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
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
  ...props
}: CircleButtonProps) => {
  const { play: hoverClick } = useUiSounds(soundSelector.hoverClick);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const { play: playClick } = useUiSounds(soundSelector.click);

  return (
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
        "flex relative transition-all duration-150  cursor-pointer items-center justify-center shadow-black/50 fill-current text-gold hover:border-gold border-gold/40 rounded  bg-brown  shadow-2xl bg-no-repeat hover:bg-brown/75 clip-angled",
        className,
        sizes[size],
        { "opacity-50 cursor-not-allowed": disabled },
        { " border-gold sepia-0 border-2": active },
        { " border-brown/30 sepia-[.50]": !active },
      )}
      style={{
        backgroundImage: image ? `url(${image})` : active ? "" : "",
        backgroundSize: "calc(100% - 10px)", // Ensure the image covers the button
        backgroundPosition: "center", // Center the background image
        padding: image ? "5px" : "0",
      }}
      disabled={disabled}
      {...props}
    >
      {notification ? (
        <div className="absolute -top-1 -left-1 rounded-full border bg-green/90 text-brown px-1 text-xxs">
          {notification}
        </div>
      ) : (
        <></>
      )}

      {children}
    </button>
  );
};

export default CircleButton;
