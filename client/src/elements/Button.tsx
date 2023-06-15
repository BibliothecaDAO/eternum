import React from "react";

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  variant: "primary" | "secondary" | "success" | "danger";
}

const STYLES = {
  baseStyle: "h-8 inline-flex transition-all duration-300 items-center justify-center p-3 text-xs font-medium rounded-lg",
  default:
    "text-white/90 border border-transparent shadow-sm",
  enabledStyle:
    "bg-black/10 hover:bg-black/30 focus:outline-none",
  disabledStyle: "bg-gray-300 cursor-not-allowed",
  success: "border border-brilliance !text-brilliance bg-transparent hover:bg-brilliance/10",
}
const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  className = "",
  disabled = false,
  variant = "default",
}) => {

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={`${STYLES.baseStyle} ${STYLES[variant]} ${disabled ? STYLES.disabledStyle : STYLES.enabledStyle
        } ${className}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
