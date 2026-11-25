import "./frontier-bar.css";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { Tone } from "@/ui/design-system/kit/tone";
import type { ReactNode } from "react";

import { STORE_TONES } from "./status-strip";

const RING_RADIUS = 19;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const ProgressRing = ({
  size = "md",
  share,
  tone,
  badge,
  className,
  children,
}: {
  size?: "sm" | "md" | "lg";
  share?: number;
  tone: Tone;
  badge?: ReactNode;
  className?: string;
  children?: ReactNode;
}) => {
  const clamped = share === undefined ? undefined : Math.min(1, Math.max(0, share));
  return (
    <span
      className={cn("frontier-progress-ring", `frontier-progress-ring--${size}`, className)}
      data-tone={tone}
      data-fill-share={clamped === undefined ? undefined : String(Math.round(clamped * 100))}
    >
      <svg viewBox="0 0 44 44" className="frontier-progress-ring__svg" aria-hidden="true">
        <circle cx="22" cy="22" r={RING_RADIUS} className="frontier-progress-ring__track" />
        {clamped !== undefined && (
          <circle
            cx="22"
            cy="22"
            r={RING_RADIUS}
            className="frontier-progress-ring__fill"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - clamped)}
            transform="rotate(-90 22 22)"
          />
        )}
      </svg>
      <span className="frontier-progress-ring__center">{children}</span>
      {badge && (
        <span className="frontier-progress-ring__badge" data-tone={STORE_TONES[tone].meter}>
          {badge}
        </span>
      )}
    </span>
  );
};
