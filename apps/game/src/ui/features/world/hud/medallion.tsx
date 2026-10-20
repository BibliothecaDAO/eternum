import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import type { ReactNode } from "react";
import "./hud.css";

type MedallionSize = "sm" | "lg";
type Tone = "plain" | "lit" | "ready";

const ICON_PIXELS: Record<MedallionSize, number> = { sm: 26, lg: 44 };

/**
 * The HUD's one icon shape: a painted icon inside a round bubble it never leaves, with numbers on badges
 * pinned to the rim. `ring` draws a production arc around it (a share from 0 to 1). A medallion never changes size,
 * so nothing around it moves when it lights or a badge appears.
 */
export const Medallion = ({
  icon,
  size,
  tone = "plain",
  ring,
  corner,
  foot,
  className,
}: {
  icon: IconMeaning;
  size: MedallionSize;
  tone?: Tone;
  ring?: number;
  /** Top-right badge: a count or a level. */
  corner?: ReactNode;
  /** Badge across the bottom rim: an amount. */
  foot?: ReactNode;
  className?: string;
}) => (
  <span className={cn("hud-medallion", `hud-medallion--${size}`, `hud-medallion--${tone}`, className)}>
    {ring !== undefined && (
      <span
        aria-hidden="true"
        className="hud-medallion__ring"
        style={{ "--hud-ring": `${Math.round(Math.min(1, Math.max(0, ring)) * 360)}deg` } as React.CSSProperties}
      />
    )}
    <span className="hud-medallion__face">
      <Icon name={icon} size={ICON_PIXELS[size]} />
    </span>
    {corner !== undefined && <span className="hud-badge hud-badge--corner">{corner}</span>}
    {foot !== undefined && <span className="hud-badge hud-badge--foot">{foot}</span>}
  </span>
);
