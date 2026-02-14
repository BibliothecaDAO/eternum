import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";

interface GamePillarSectionProps {
  pillarNumber: number; // 1-5
  title: string; // "Explore", "Conquer", etc.
  tagline: string; // Short banner text above title
  description: string; // 2-3 sentence description
  icon: LucideIcon; // Lucide icon component
  hexColor: string; // Accent color for hex decoration
  direction: "left" | "right"; // Text side
  children?: React.ReactNode; // Optional extra content below description
}

/**
 * Honeycomb hex cluster layout (7 hexagons):
 *    ⬡ ⬡
 *   ⬡ ⬡ ⬡   (center is the icon hex)
 *    ⬡ ⬡
 *
 * Each hex is ~80px wide. The center hex has a brighter border and contains the icon.
 * Surrounding hexes have a subtle fill with hexColor at low opacity.
 */

// Pointy-top hexagon centered at origin (40,40) with circumradius 40
// Width ≈ 69.28, Height = 80
const HEX_POINTS = "40,0 74.64,20 74.64,60 40,80 5.36,60 5.36,20";

// Honeycomb positions for 7 hexagons (center + 6 surrounding)
// Pointy-top hex: center-to-center distance = sqrt(3) * r ≈ 69.28
// Using 75px spacing (includes ~6px gap between edges)
// Neighbors at 0°, 60°, 120°, 180°, 240°, 300° from center
const HEX_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 140, y: 140 },     // Center
  { x: 215, y: 140 },     // E  (0°)
  { x: 177.5, y: 75 },    // NE (60°)
  { x: 102.5, y: 75 },    // NW (120°)
  { x: 65, y: 140 },      // W  (180°)
  { x: 102.5, y: 205 },   // SW (240°)
  { x: 177.5, y: 205 },   // SE (300°)
];

const SVG_SIZE = 280;

// Framer-motion variants
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const hexClusterVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.3,
    },
  },
};

const centerHexVariant = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

const surroundHexVariant = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export function GamePillarSection({
  pillarNumber,
  title,
  tagline,
  description,
  icon: Icon,
  hexColor,
  direction,
  children,
}: GamePillarSectionProps) {
  const padded = String(pillarNumber).padStart(2, "0");
  const isRight = direction === "right";

  return (
    <section className="relative py-20 sm:py-28">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
          {/* Text column */}
          <motion.div
            className={isRight ? "md:order-2" : ""}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <motion.p variants={fadeUp} className="realm-banner mb-4">
              {padded} &mdash; {tagline}
            </motion.p>

            <motion.h2
              variants={fadeUp}
              className="realm-title text-3xl sm:text-5xl md:text-6xl mb-5"
            >
              {title}
            </motion.h2>

            <motion.p
              variants={fadeUp}
              className="text-foreground/80 text-base sm:text-lg leading-relaxed max-w-lg"
            >
              {description}
            </motion.p>

            {children && <motion.div variants={fadeUp} className="mt-6">{children}</motion.div>}
          </motion.div>

          {/* Hex visual column */}
          <motion.div
            className={`flex items-center justify-center ${isRight ? "md:order-1" : ""}`}
            variants={hexClusterVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <div className="relative">
              <style>{`
                @keyframes hex-cluster-rotate {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                .hex-cluster-spin {
                  animation: hex-cluster-rotate 60s linear infinite;
                }
              `}</style>

              <svg
                width={SVG_SIZE}
                height={SVG_SIZE}
                viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                className="hex-cluster-spin"
                style={{ maxWidth: "100%", height: "auto" }}
              >
                {/* Surrounding hexagons (indices 1-6) */}
                {HEX_POSITIONS.slice(1).map((pos, i) => (
                  <motion.g
                    key={`surround-${i}`}
                    variants={surroundHexVariant}
                    style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                  >
                    <polygon
                      points={HEX_POINTS}
                      transform={`translate(${pos.x - 40}, ${pos.y - 40})`}
                      fill={hexColor}
                      fillOpacity="0.1"
                      stroke={hexColor}
                      strokeWidth="1"
                      strokeOpacity="0.35"
                    />
                  </motion.g>
                ))}

                {/* Center hexagon - brighter, with icon */}
                <motion.g
                  variants={centerHexVariant}
                  style={{
                    transformOrigin: `${HEX_POSITIONS[0].x}px ${HEX_POSITIONS[0].y}px`,
                  }}
                >
                  <polygon
                    points={HEX_POINTS}
                    transform={`translate(${HEX_POSITIONS[0].x - 40}, ${HEX_POSITIONS[0].y - 40})`}
                    fill={hexColor}
                    fillOpacity="0.08"
                    stroke={hexColor}
                    strokeWidth="1.5"
                    strokeOpacity="0.7"
                  />
                </motion.g>
              </svg>

              {/* Icon overlay on center hex - stays upright while cluster spins */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Icon
                  className="w-8 h-8 sm:w-10 sm:h-10"
                  style={{ color: hexColor }}
                  strokeWidth={1.5}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
