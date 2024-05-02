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
            position: "bottom",
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
        "flex transition-all duration-150  cursor-pointer items-center justify-center shadow-black/50 fill-current text-gold hover:border-gold hover:opacity-90 border-2  bg-gold/60 shadow-2xl  hover:sepia-0",
        className,
        sizes[size],
        { "opacity-50 cursor-not-allowed": disabled },
        { " border-gold sepia-0": active },
        { " border-brown/30 sepia-[.75]": !active },
      )}
      style={{
        backgroundImage: image ? `url(${image})` : active ? "" : "",
        backgroundSize: "cover", // Ensure the image covers the button
        backgroundPosition: "center", // Center the background image
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default CircleButton;
