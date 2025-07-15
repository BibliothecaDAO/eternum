import { RefreshCw } from "lucide-react";
import { ButtonHTMLAttributes } from "react";

interface RefreshButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
}

export const RefreshButton = ({ 
  isLoading = false, 
  size = "md",
  className = "",
  disabled,
  ...props 
}: RefreshButtonProps) => {
  const sizeClasses = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-3"
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5"
  };

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`${sizeClasses[size]} rounded-lg bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50 ${className}`}
      title={props.title || "Refresh data"}
    >
      <RefreshCw className={`${iconSizes[size]} text-gold ${isLoading ? "animate-spin" : ""}`} />
    </button>
  );
};