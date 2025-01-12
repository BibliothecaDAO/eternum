import React from "react";
import { soundSelector, useUiSounds } from "@/hooks/use-ui-sound";

type ButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  isPulsing?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "success" | "red" | "danger" | "default" | "outline" | "opaque";
  isLoading?: boolean;
  withoutSound?: boolean;
  size?: "xs" | "md";
} & React.ComponentPropsWithRef<"button">;

const STYLES = {
  baseStyle:
    "inline-flex whitespace-nowrap cursor-pointer white transition-all duration-300 items-center justify-center p-2 text-xs font-medium text-gold uppercase rounded",
  primary:
    "px-6 py-2 bg-brown from-yellow-600 to-yellow-700  font-semibold text-lg uppercase tracking-wider  shadow-md hover:from-yellow-700 hover:to-yellow-800 focus:outline-none border-2  outline-gold hover:bg-gold hover:text-brown  border-y hover:border-gold ",
  default: "bg-brown px-6 py-2 text-gold",
  enabledStyle: "bg-brown/10 hover:bg-brown/30 focus:outline-none",
  disabledStyle: "!bg-gray-300 cursor-not-allowed !border-gray-gold !text-gray-gold",
  success: "border border-green !text-brilliance bg-transparent hover:bg-green/10",
  red: "border border-danger !text-danger bg-transparent hover:bg-danger/10",
  outline: "border border-gold text-gold bg-transparent hover:bg-gold/10",
  danger: "bg-red border-red text-gold bg-transparent hover:bg-red/90 ",
  secondary: "border border-orange text-orange bg-transparent hover:bg-orange/10",
  opaque:
    "px-6 py-2 bg-brown font-semibold text-lg uppercase tracking-wider shadow-md hover:from-yellow-700 hover:to-yellow-800 focus:outline-none border-2 outline-gold hover:bg-gold border-y hover:border-gold hover:bg-brown/90 bg-brown/40 hover:text-black/90",
  loadingStyle: "relative",
};

const SIZES = {
  xs: "text-xxs h-4 ",
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
      className={` ${STYLES.baseStyle} ${STYLES[variant]} ${isLoading ? STYLES.loadingStyle : ""} ${
        isPulsing ? "animate-pulse" : ""
      } ${SIZES[size]} ${disabled ? STYLES.disabledStyle : ""} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className={`w-full inset-0 flex flex-col items-center justify-center h-full`}>
          <div className="w-4 h-4 border-t-2 border-b-2 border-gray-900 rounded-full animate-spin"></div>{" "}
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
