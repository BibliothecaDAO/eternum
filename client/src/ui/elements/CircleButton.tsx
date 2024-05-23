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
        "flex relative transition-all duration-150  cursor-pointer items-center justify-center shadow-black/50 fill-current text-gold hover:border-gold  rounded    shadow-2xl   group",
        className,
        sizes[size],
        { "opacity-50 cursor-not-allowed": disabled },
        { " !border-gold sepia-0 ": active },
        { " border-brown/30 sepia-[.50] ": !active },
      )}
      disabled={disabled}
      {...props}
    >
      {notification ? (
        <div className="animate-bounce absolute -top-1 -left-1 rounded-full border border-green/30 bg-green/90 text-brown px-2 text-xxs z-[100] font-bold">
          {notification}
        </div>
      ) : (
        <></>
      )}
      {children}
      <div
        style={{
          backgroundImage: image ? `url(${image})` : active ? "" : "",
          backgroundSize: "calc(100% - 10px)", // Ensure the image covers the button
          backgroundPosition: "center", // Center the background image
          padding: image ? "5px" : "0",
        }}
        className={`absolute w-[calc(100%-3px)] h-[calc(100%-3px)] bg-no-repeat z-10 clip-angled-sm  hover:bg-gold duration-300 ${
          active ? "bg-gold/60" : "bg-brown/80"
        }`}
      ></div>
      <div
        className={`absolute  w-[calc(100%+2px)] h-[calc(100%+2px)] clip-angled-sm ${active ? "bg-gold/40" : " "}`}
      ></div>
    </button>
  );
};

export default CircleButton;
