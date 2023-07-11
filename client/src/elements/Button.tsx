import React from "react";

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "success" | "danger" | "default" | "outline";
  isLoading?: boolean;
}

const STYLES = {
  baseStyle: "inline-flex transition-all duration-300 items-center justify-center p-2 text-xs font-medium rounded-md",
  primary: "!rounded-full py-1 bg-gold hover:bg-gold/50 focus:outline-none",
  default:
    "text-white/90 border border-transparent shadow-sm",
  enabledStyle:
    "bg-black/10 hover:bg-black/30 focus:outline-none",
  disabledStyle: "bg-gray-300 cursor-not-allowed",
  success: "border border-brilliance !text-brilliance bg-transparent hover:bg-brilliance/10",
  outline: "border border-gold !text-gold bg-transparent hover:bg-gold/10",
  danger: "border border-orange !text-orange bg-transparent hover:bg-orange/10",
  secondary: "border border-orange !text-orange bg-transparent hover:bg-orange/10",
  loadingStyle: "relative",

}
const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  className = "",
  disabled = false,
  variant = "default",
  isLoading = false,
}) => {
  return (
    <button
      type="button"
      onClick={disabled || isLoading ? undefined : onClick}
      className={`${STYLES.baseStyle} ${STYLES[variant]} ${disabled ? STYLES.disabledStyle : STYLES.enabledStyle
        } ${isLoading ? STYLES.loadingStyle : ""} ${className}`}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-t-2 border-b-2 border-gray-900 rounded-full animate-spin"></div>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
