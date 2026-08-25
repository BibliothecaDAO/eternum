interface HexSectionDividerProps {
  color?: string; // default "currentColor"
  className?: string;
}

/**
 * A lightweight SVG-based hexagonal divider between content sections.
 * Renders a horizontal row of 9 small hex shapes with extending lines,
 * featuring a subtle glow-pulse animation on the center hexagons.
 */
export function HexSectionDivider({
  color = "currentColor",
  className = "",
}: HexSectionDividerProps) {
  const hexCount = 9;

  // Opacity per hex position: center is brightest, fading toward edges
  const opacities = [0.15, 0.22, 0.35, 0.5, 0.6, 0.5, 0.35, 0.22, 0.15];

  // Points for a 24px-wide flat-top hexagon centered at (12, 12)
  const hexPoints = "12,0 22.39,6 22.39,18 12,24 1.61,18 1.61,6";

  return (
    <div
      className={`flex items-center justify-center py-8 ${className}`}
      aria-hidden="true"
    >
      <style>{`
        @keyframes hex-glow-pulse {
          0%, 100% { opacity: 0.3; filter: drop-shadow(0 0 2px ${color === "currentColor" ? "currentColor" : color}); }
          50% { opacity: 0.6; filter: drop-shadow(0 0 6px ${color === "currentColor" ? "currentColor" : color}); }
        }
        .hex-glow {
          animation: hex-glow-pulse 3s ease-in-out infinite;
        }
      `}</style>

      {/* Left extending line */}
      <div
        className="h-px flex-1 max-w-24"
        style={{
          background: `linear-gradient(90deg, transparent, ${color === "currentColor" ? "var(--realm-border-etched)" : color})`,
          opacity: 0.35,
        }}
      />

      {/* Hex row */}
      <div className="flex items-center gap-1 mx-2">
        {Array.from({ length: hexCount }).map((_, i) => (
          <svg
            key={i}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            className={i >= 3 && i <= 5 ? "hex-glow" : ""}
            style={{
              opacity: opacities[i],
              animationDelay: i >= 3 && i <= 5 ? `${(i - 3) * 0.4}s` : undefined,
            }}
          >
            <polygon
              points={hexPoints}
              fill="none"
              stroke={color}
              strokeWidth="1"
            />
          </svg>
        ))}
      </div>

      {/* Right extending line */}
      <div
        className="h-px flex-1 max-w-24"
        style={{
          background: `linear-gradient(90deg, ${color === "currentColor" ? "var(--realm-border-etched)" : color}, transparent)`,
          opacity: 0.35,
        }}
      />
    </div>
  );
}
