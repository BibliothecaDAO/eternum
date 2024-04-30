import React from "react";
import { soundSelector, useUiSounds } from "../../hooks/useUISound";

type ButtonProps = {
  onClick: () => void;
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
    "inline-flex whitespace-nowrap cursor-pointer white transition-all duration-300 items-center justify-center p-2 text-xs font-medium text-gold uppercase",
  primary:
    "px-6 py-2 bg-gradient-to-r from-yellow-600 to-yellow-700  font-semibold text-lg uppercase tracking-wider  shadow-md hover:from-yellow-700 hover:to-yellow-800 focus:outline-none  border-y-2 border-gold border-x hover:bg-gold hover:text-brown",
  default: "text-white/90 border border-transparent shadow-sm",
  enabledStyle: "bg-black/10 hover:bg-black/30 focus:outline-none",
  disabledStyle: "bg-gray-300 cursor-not-allowed !border-gray-gold !text-gray-gold",
  success: "border border-brilliance !text-brilliance bg-transparent hover:bg-brilliance/10",
  red: "border border-danger !text-danger bg-transparent hover:bg-danger/10",
  outline: "border border-gold !text-gold bg-transparent hover:bg-gold/10",
  danger: "border border-orange !text-orange bg-transparent hover:bg-orange/10",
  secondary: "border border-orange !text-orange bg-transparent hover:bg-orange/10",
  loadingStyle: "relative",
};

const SIZES = {
  xs: "text-xxs h-4",
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
      onClick={() => {
        if (!disabled && !isLoading) {
          onClick();
          !withoutSound && playClick();
        }
      }}
      className={`${STYLES.baseStyle} ${STYLES[variant]} ${disabled ? STYLES.disabledStyle : STYLES.enabledStyle} ${
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
