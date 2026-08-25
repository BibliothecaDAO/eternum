interface HexCTAFrameProps {
  color?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A decorative hexagonal frame that wraps CTA content with hex clusters
 * on either side, connected by gradient lines toward the center.
 * Side decorations are hidden on mobile.
 */
export function HexCTAFrame({
  color = "currentColor",
  children,
  className = "",
}: HexCTAFrameProps) {
  // Pointy-top hex path for a 32x36 viewBox (pointy-top orientation)
  // Points: top, upper-right, lower-right, bottom, lower-left, upper-left
  const hexPoints = "16,0 30.86,9 30.86,27 16,36 1.14,27 1.14,9";

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <style>{`
        @keyframes hex-cta-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }
        .hex-cta-cluster polygon {
          animation: hex-cta-pulse 4s ease-in-out infinite;
        }
      `}</style>

      {/* Left hex cluster + connecting line */}
      <div className="hidden md:flex items-center flex-shrink-0">
        <svg
          width="40"
          height="120"
          viewBox="0 0 40 120"
          className="hex-cta-cluster flex-shrink-0"
        >
          {/* Top hex */}
          <g transform="translate(4, 2)">
            <polygon
              points={hexPoints}
              fill="none"
              stroke={color}
              strokeWidth="1"
              opacity="0.3"
              style={{ animationDelay: "0s" }}
            />
          </g>
          {/* Middle hex (offset right) */}
          <g transform="translate(8, 40)">
            <polygon
              points={hexPoints}
              fill="none"
              stroke={color}
              strokeWidth="1"
              opacity="0.4"
              style={{ animationDelay: "0.5s" }}
            />
          </g>
          {/* Bottom hex */}
          <g transform="translate(4, 78)">
            <polygon
              points={hexPoints}
              fill="none"
              stroke={color}
              strokeWidth="1"
              opacity="0.3"
              style={{ animationDelay: "1s" }}
            />
          </g>
        </svg>

        {/* Connecting gradient line (left to center) */}
        <div
          className="h-px w-10 lg:w-16 flex-shrink-0"
          style={{
            background: `linear-gradient(90deg, ${color}, transparent)`,
            opacity: 0.3,
          }}
        />
      </div>

      {/* Center content */}
      <div className="flex-shrink-0">{children}</div>

      {/* Right hex cluster + connecting line */}
      <div className="hidden md:flex items-center flex-shrink-0">
        {/* Connecting gradient line (center to right) */}
        <div
          className="h-px w-10 lg:w-16 flex-shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${color})`,
            opacity: 0.3,
          }}
        />

        <svg
          width="40"
          height="120"
          viewBox="0 0 40 120"
          className="hex-cta-cluster flex-shrink-0"
          style={{ transform: "scaleX(-1)" }}
        >
          {/* Top hex */}
          <g transform="translate(4, 2)">
            <polygon
              points={hexPoints}
              fill="none"
              stroke={color}
              strokeWidth="1"
              opacity="0.3"
              style={{ animationDelay: "0.3s" }}
            />
          </g>
          {/* Middle hex (offset right, mirrored) */}
          <g transform="translate(8, 40)">
            <polygon
              points={hexPoints}
              fill="none"
              stroke={color}
              strokeWidth="1"
              opacity="0.4"
              style={{ animationDelay: "0.8s" }}
            />
          </g>
          {/* Bottom hex */}
          <g transform="translate(4, 78)">
            <polygon
              points={hexPoints}
              fill="none"
              stroke={color}
              strokeWidth="1"
              opacity="0.3"
              style={{ animationDelay: "1.3s" }}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
