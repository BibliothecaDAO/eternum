import { cn } from "./lib/utils";
import Button from "./button";
import React from "react";

interface MaxButtonProps {
  max: number | (() => number);
  onChange: (value: string) => void;
  variant?: "button" | "text" | "icon";
  label?: string;
  disabled?: boolean;
  className?: string;
  size?: "xs" | "md" | "lg";
}

export const MaxButton = React.forwardRef<HTMLButtonElement | HTMLDivElement, MaxButtonProps>(
  ({ max, onChange, variant = "button", label = "Max", disabled = false, className, size = "md" }, ref) => {
    const handleClick = () => {
      if (disabled) return;
      const maxValue = typeof max === "function" ? max() : max;
      onChange(maxValue.toString());
    };

    const isDisabled = disabled || (typeof max === "number" && max <= 0);

    if (variant === "text") {
      return (
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          onClick={handleClick}
          className={cn(
            "cursor-pointer text-sm hover:text-primary transition-colors",
            isDisabled && "cursor-not-allowed opacity-50 hover:text-current",
            className,
          )}
        >
          {label}
        </div>
      );
    }

    if (variant === "icon") {
      return (
        <Button
          ref={ref as React.Ref<HTMLButtonElement>}
          variant="outline"
          size="xs"
          onClick={handleClick}
          disabled={isDisabled}
          className={cn("h-8 w-8 p-0", className)}
        >
          <span className="text-xs font-medium">M</span>
        </Button>
      );
    }

    // Default button variant
    return (
      <Button
        ref={ref as React.Ref<HTMLButtonElement>}
        variant="outline"
        size={size}
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(className)}
      >
        {label}
      </Button>
    );
  },
);

MaxButton.displayName = "MaxButton";
