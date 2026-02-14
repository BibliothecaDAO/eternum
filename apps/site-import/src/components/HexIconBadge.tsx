import { type LucideIcon } from "lucide-react";

interface HexIconBadgeProps {
  icon: LucideIcon;
  color?: string;
  size?: "sm" | "md";
  className?: string;
}

const HEX_CLIP_PATH =
  "polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)";

const sizeConfig = {
  sm: { outer: 48, icon: 20 },
  md: { outer: 64, icon: 28 },
} as const;

export function HexIconBadge({
  icon: Icon,
  color = "var(--primary)",
  size = "md",
  className = "",
}: HexIconBadgeProps) {
  const { outer, icon: iconSize } = sizeConfig[size];

  return (
    <div
      className={className}
      style={{
        width: outer,
        height: outer,
        position: "relative",
        filter: `drop-shadow(0 0 8px color-mix(in srgb, ${color} 30%, transparent))`,
      }}
    >
      {/* Outer "border" hex */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: HEX_CLIP_PATH,
          background: `color-mix(in srgb, ${color} 25%, transparent)`,
        }}
      />
      {/* Inner "fill" hex */}
      <div
        style={{
          position: "absolute",
          inset: 2,
          clipPath: HEX_CLIP_PATH,
          background: `linear-gradient(135deg, color-mix(in srgb, ${color} 10%, rgb(8 8 11)), rgb(8 8 11))`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon style={{ width: iconSize, height: iconSize, color }} />
      </div>
    </div>
  );
}
