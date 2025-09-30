import { HOVER_STYLES, LABEL_STYLES } from "@/three/utils/labels/label-config";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useState } from "react";

export type InfoLabelVariant = "ally" | "attack" | "chest" | "default" | "mine" | "quest";

const INFO_LABEL_VARIANT_STYLES: Record<
  InfoLabelVariant,
  {
    default: (typeof LABEL_STYLES)[keyof typeof LABEL_STYLES];
    hover: (typeof HOVER_STYLES)[keyof typeof HOVER_STYLES];
  }
> = {
  ally: {
    default: LABEL_STYLES.ALLY,
    hover: HOVER_STYLES.ALLY,
  },
  attack: {
    default: LABEL_STYLES.ENEMY,
    hover: HOVER_STYLES.ENEMY,
  },
  chest: {
    default: LABEL_STYLES.CHEST,
    hover: HOVER_STYLES.CHEST,
  },
  default: {
    default: LABEL_STYLES.NEUTRAL,
    hover: HOVER_STYLES.NEUTRAL,
  },
  mine: {
    default: LABEL_STYLES.MINE,
    hover: HOVER_STYLES.MINE,
  },
  quest: {
    default: LABEL_STYLES.CHEST,
    hover: HOVER_STYLES.CHEST,
  },
};

const INFO_LABEL_BASE_CLASSES =
  "relative flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold leading-tight transition-colors duration-200 backdrop-blur-[2px]";

const amplifyOpacity = (color?: string) => {
  if (!color) return color;
  const match = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i);
  if (!match) return color;
  const [, r, g, b, a] = match;
  const alpha = Math.min(parseFloat(a) * 1.8, 1);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface InfoLabelProps {
  variant?: InfoLabelVariant;
  className?: string;
  children: ReactNode;
}

export const InfoLabel = ({ variant = "default", className, children }: InfoLabelProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const styleSet = INFO_LABEL_VARIANT_STYLES[variant] ?? INFO_LABEL_VARIANT_STYLES.default;
  const defaultBackground = amplifyOpacity(styleSet.default.backgroundColor);
  const hoverBackground = amplifyOpacity(styleSet.hover.backgroundColor) ?? defaultBackground;
  const borderColor = amplifyOpacity(styleSet.default.borderColor) ?? styleSet.default.borderColor ?? "transparent";

  return (
    <div
      className={clsx(INFO_LABEL_BASE_CLASSES, className)}
      style={{
        backgroundColor: isHovered ? hoverBackground ?? defaultBackground : defaultBackground,
        borderColor,
        color: styleSet.default.textColor ?? "inherit",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </div>
  );
};
