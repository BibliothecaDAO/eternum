import { useUISound } from "@/audio";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import React from "react";

type ButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  isPulsing?: boolean;
  disabled?: boolean;
  variant?:
    | "primary"
    | "primarySelected"
    | "secondary"
    | "success"
    | "red"
    | "danger"
    | "default"
    | "outline"
    | "opaque"
    | "gold";
  isLoading?: boolean;
  withoutSound?: boolean;
  size?: "xs" | "md" | "lg";
  forceUppercase?: boolean;
} & React.ComponentPropsWithRef<"button">;

/**
 * The older variants, read as the HUD sheet's button kinds (hud-sheet.css .ui-button): the gold ones are the one
 * primary, a red one is a secondary in the bad tone, every other one a secondary.
 */
const KIND: Record<NonNullable<ButtonProps["variant"]>, { kind: "primary" | "secondary"; tone?: "bad" }> = {
  primary: { kind: "primary" },
  primarySelected: { kind: "primary" },
  gold: { kind: "primary" },
  opaque: { kind: "primary" },
  secondary: { kind: "secondary" },
  success: { kind: "secondary" },
  default: { kind: "secondary" },
  outline: { kind: "secondary" },
  red: { kind: "secondary", tone: "bad" },
  danger: { kind: "secondary", tone: "bad" },
};

/** The HUD's older button, drawn as the sheet's: its click sound, a spinner while it loads, a pulse when asked. */
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
  forceUppercase = false,
  ...props
}) => {
  const playClick = useUISound("ui.click");
  const { kind, tone } = KIND[variant];
  return (
    <button
      type="button"
      onClick={(e) => {
        if (!disabled && !isLoading && onClick) {
          onClick(e);
          !withoutSound && playClick();
        }
      }}
      className={cn("ui-button", forceUppercase && "hud-caps-button", isPulsing && "animate-pulse", className)}
      data-kind={kind}
      data-tone={tone}
      data-size={size === "xs" ? "sm" : "md"}
      aria-pressed={variant === "primarySelected" ? true : undefined}
      aria-busy={isLoading || undefined}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <span className="ui-spinner" aria-hidden="true" /> : children}
    </button>
  );
};

export default Button;
