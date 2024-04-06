import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import clsx from "clsx";

type CircleButtonProps = {
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
  size: "xs" | "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  active?: boolean;
} & React.ComponentPropsWithRef<"button">;

const sizes = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-14 h-14",
};

const CircleButton = ({ onClick, children, className, size, disabled, active, ...props }: CircleButtonProps) => {
  const { play: hoverClick, stop } = useUiSounds(soundSelector.hoverClick);

  const { play: playClick } = useUiSounds(soundSelector.click);
  return (
    <button
      // onMouseOver={() => hoverClick()}
      // onMouseLeave={() => stop()}
      onClick={() => {
        if (!disabled) {
          onClick();
          playClick();
        }
      }}
      className={clsx(
        "flex transition-all duration-150  border-gold border   cursor-pointer items-center justify-center   rounded-xl shadow-lg  shadow-black/50  fill-current text-gold hover:border-white/20",
        className,
        sizes[size],
        { "opacity-50 cursor-not-allowed": disabled },
        { "translate-y-0.5 border-white/20": active },
        { "hover:-translate-y-0.5 ": !active },
      )}
      style={{
        backgroundImage: active
          ? "radial-gradient(50% 50.00% at 50% 100%, rgba(255, 255, 255, 0.20) 0%, rgba(255, 255, 255, 0.00) 100%), linear-gradient(0deg, #4B413C 0%, #24130A 100%)"
          : "radial-gradient(50% 50.00% at 50% 0.00%, rgba(255, 255, 255, 0.20) 0%, rgba(255, 255, 255, 0.00) 100%), linear-gradient(180deg, #4B413C 0%, #24130A 100%)",
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default CircleButton;
