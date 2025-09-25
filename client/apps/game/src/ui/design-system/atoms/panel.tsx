import clsx from "clsx";
import { ElementType, HTMLAttributes, forwardRef } from "react";

type PanelTone = "wood" | "overlay" | "glass" | "neutral";
type PanelPadding = "none" | "sm" | "md" | "lg" | "xl";
type PanelRadius = "sm" | "md" | "lg" | "xl" | "2xl";
type PanelShadow = "none" | "soft" | "lg";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  as?: ElementType;
  tone?: PanelTone;
  padding?: PanelPadding;
  radius?: PanelRadius;
  shadow?: PanelShadow;
  border?: "none" | "subtle" | "strong";
  blur?: boolean;
  isInteractive?: boolean;
}

const toneClassMap: Record<PanelTone, string> = {
  wood: "bg-dark-wood panel-wood",
  overlay: "bg-brown/90 panel-wood",
  glass: "bg-black/20",
  neutral: "bg-brown/20",
};

const paddingClassMap: Record<PanelPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
  xl: "p-8",
};

const radiusClassMap: Record<PanelRadius, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

const shadowClassMap: Record<PanelShadow, string> = {
  none: "",
  soft: "shadow-md",
  lg: "shadow-lg",
};

const borderClassMap = {
  none: "",
  subtle: "border border-gold/20",
  strong: "border border-gold/10",
};

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  (
    {
      as: Component = "div",
      className,
      tone = "wood",
      padding = "md",
      radius = "lg",
      shadow = "none",
      border = "subtle",
      blur = false,
      isInteractive = false,
      ...props
    },
    ref,
  ) => {
    return (
      <Component
        ref={ref}
        className={clsx(
          "transition-colors duration-200",
          toneClassMap[tone],
          paddingClassMap[padding],
          radiusClassMap[radius],
          shadowClassMap[shadow],
          borderClassMap[border],
          blur && "backdrop-blur-sm",
          isInteractive && "hover:border-gold/60",
          className,
        )}
        {...props}
      />
    );
  },
);

Panel.displayName = "Panel";

export default Panel;
