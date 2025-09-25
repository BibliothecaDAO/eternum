import type { ReactNode } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";

interface CircularProgressProps {
  progress: number;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
  className?: string;
  color?: "red" | "green" | "gold";
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
} as const;

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

const colorClasses = {
  red: "stroke-red",
  green: "stroke-green",
  gold: "stroke-gold",
} as const;

export const CircularProgress = ({
  progress,
  size = "sm",
  children,
  className,
  color = "red",
}: CircularProgressProps) => {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const strokeWidth = size === "sm" ? 2 : size === "md" ? 3 : 4;
  const radius = size === "sm" ? 12 : size === "md" ? 18 : 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", sizeClasses[size], className)}>
      <svg className="w-full h-full -rotate-90">
        <circle cx="50%" cy="50%" r={radius} className="fill-none stroke-gray-700 opacity-25" strokeWidth={strokeWidth} />
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          className={cn("fill-none transition-all duration-300 ease-in-out", colorClasses[color])}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className={cn("absolute inset-0 flex items-center justify-center", textSizeClasses[size])}>{children}</div>
    </div>
  );
};
