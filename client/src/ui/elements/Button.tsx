import React from "react";
import { soundSelector, useUiSounds } from "../../hooks/useUISound";

type ButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  isPulsing?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "success" | "red" | "danger" | "default" | "outline";
  isLoading?: boolean;
  withoutSound?: boolean;
  size?: "xs" | "md";
} & React.ComponentPropsWithRef<"button">;

const STYLES = {
  baseStyle:
    "inline-flex whitespace-nowrap cursor-pointer white transition-all duration-300 items-center justify-center p-2 text-xs font-medium text-gold uppercase rounded",
  primary:
    "px-6 py-2 bg-crimson from-yellow-600 to-yellow-700  font-semibold text-lg uppercase tracking-wider  shadow-md hover:from-yellow-700 hover:to-yellow-800 focus:outline-none outline-gradient  outline-gold hover:bg-gold hover:text-brown clip-angled border-gradient border-y hover:border-crimson ",
  default: "text-white/90 bg-gold/20 border border-transparent shadow-sm clip-angled !text-gold px-6 py-2 ",
  enabledStyle: "bg-black/10 hover:bg-black/30 focus:outline-none",
  disabledStyle: "bg-gray-300 cursor-not-allowed !border-gray-gold !text-gray-gold",
  success: "border border-green !text-brilliance bg-transparent hover:bg-green/10",
  red: "border border-danger !text-danger bg-transparent hover:bg-danger/10",
  outline: "border border-gold !text-gold bg-transparent hover:bg-gold/10",
  danger: "bg-red border-red !text-gold bg-transparent hover:bg-red/90 ",
  secondary: "border border-orange !text-orange bg-transparent hover:bg-orange/10",
  loadingStyle: "relative",
};

const SIZES = {
  xs: "text-xxs h-4 clip-angled-sm ",
  md: "",
};

const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  className = "",
  isPulsing = false,
  disabled = false,
  variant = "default",
  isLoading = false,
  withoutSound = false,
  size = "md",
  ...props
}) => {
  const { play: playClick } = useUiSounds(soundSelector.click);

  return (
    <button
      type="button"
      onClick={(e) => {
        if (!disabled && !isLoading && onClick) {
          onClick(e);
          !withoutSound && playClick();
        }
      }}
      className={` ${STYLES.baseStyle} ${STYLES[variant]} ${disabled ? STYLES.disabledStyle : STYLES.enabledStyle} ${
        isLoading ? STYLES.loadingStyle : ""
      } ${isPulsing ? "animate-pulse" : ""} ${className} ${SIZES[size]}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className=" inset-0 flex items-center justify-center h-full">
          <div className="w-4 h-4 border-t-2 border-b-2 border-gray-900 rounded-full animate-spin mr-5"></div>{" "}
          Casting...
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
