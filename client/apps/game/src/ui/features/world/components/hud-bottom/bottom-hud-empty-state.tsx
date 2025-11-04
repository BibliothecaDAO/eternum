import { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { BOTTOM_HUD_SURFACE_BASE } from "./styles";

const BASE_CONTAINER_CLASS = "flex h-full min-h-[72px] flex-col justify-start gap-2";
const SURFACE_CLASS = "rounded-xl px-4 py-3";
const SUBTLE_CLASS = "rounded-none border-none bg-transparent px-0 py-0 shadow-none";
const ALIGNMENT_CLASSES: Record<"center" | "start" | "stretch", string> = {
  center: "items-center text-center",
  start: "items-start text-left",
  stretch: "items-stretch text-left",
};
const EMPTY_TEXT_BASE = "text-xs font-medium leading-relaxed text-gold/60 italic";

interface BottomHudEmptyStateProps {
  children: ReactNode;
  className?: string;
  textClassName?: string;
  icon?: ReactNode;
  align?: "center" | "start" | "stretch";
  tone?: "surface" | "subtle";
}

export const BottomHudEmptyState = ({
  children,
  className,
  textClassName,
  icon,
  align = "start",
  tone = "surface",
}: BottomHudEmptyStateProps) => {
  const containerClass = cn(
    BASE_CONTAINER_CLASS,
    ALIGNMENT_CLASSES[align],
    tone === "surface" ? [BOTTOM_HUD_SURFACE_BASE, SURFACE_CLASS] : SUBTLE_CLASS,
    tone === "subtle" ? "min-h-0" : undefined,
    className,
  );

  const textClass = cn(EMPTY_TEXT_BASE, textClassName);

  return (
    <div className={containerClass}>
      {icon && <div className="text-base text-slate-100/70">{icon}</div>}
      <div className={textClass}>{children}</div>
    </div>
  );
};
