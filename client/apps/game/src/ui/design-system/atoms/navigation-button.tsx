import { Navigation } from "lucide-react";
import { ButtonHTMLAttributes } from "react";

interface NavigationButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "ghost";
  showText?: boolean;
}

export const NavigationButton = ({
  size = "md",
  variant = "solid",
  showText = false,
  className = "",
  ...props
}: NavigationButtonProps) => {
  const sizeClasses = {
    sm: showText ? "px-2 py-1 text-xs gap-1" : "p-1.5",
    md: showText ? "px-3 py-2 text-sm gap-1.5" : "p-2",
    lg: showText ? "px-4 py-3 text-base gap-2" : "p-3",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const variantClasses = {
    solid: "bg-gold/20 hover:bg-gold/30",
    ghost: "hover:bg-gold/10",
  };

  return (
    <button
      {...props}
      className={`rounded ${variantClasses[variant]} transition-colors ${sizeClasses[size]} ${showText ? "flex items-center" : ""} ${className}`}
      title={props.title || "Navigate to location"}
    >
      <Navigation className={`${iconSizes[size]} text-gold`} />
      {showText && <span>Go</span>}
    </button>
  );
};
