import { cn } from "@/shared/lib/utils";
import React from "react";

interface ProgressCircleProps {
  progress: number; // 0-100
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  className?: string;
}

export const ProgressCircle = ({ progress, size = "md", children, className }: ProgressCircleProps) => {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const strokeWidth = size === "sm" ? 2 : size === "md" ? 3 : 4;
  const radius = size === "sm" ? 12 : size === "md" ? 18 : 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedProgress / 100) * circumference;

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", sizeClasses[size], className)}>
      <svg className="w-full h-full -rotate-90">
        {/* Background circle */}
        <circle cx="50%" cy="50%" r={radius} className="fill-none stroke-muted" strokeWidth={strokeWidth} />
        {/* Progress circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          className="fill-none stroke-primary transition-all duration-300 ease-in-out"
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
