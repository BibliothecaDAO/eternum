import { ResourceIcon } from "@/shared/ui/resource-icon";
import { getRelicInfo, RelicInfo, RELICS } from "@bibliothecadao/types";
import { motion, useMotionValue } from "framer-motion";
import { useMemo, useState } from "react";

interface RelicCarouselProps {
  foundRelics: number[];
}

const RelicCard = ({ relic, isHovered }: { relic: RelicInfo; isHovered: boolean }) => {
  return (
    <motion.div
      className="relative flex-shrink-0 mx-3"
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <div className="relative">
        <div
          className={`w-20 h-20 flex items-center justify-center rounded-xl border backdrop-blur-sm transition-all duration-200 ${
            isHovered ? "bg-gold/20 border-gold/60 shadow-lg shadow-gold/25" : "bg-dark-brown/80 border-gold/30"
          }`}
        >
          <ResourceIcon resourceId={relic.id} size={64} showTooltip={false} />
        </div>
      </div>
    </motion.div>
  );
};

export const RelicCarousel = ({ foundRelics }: RelicCarouselProps) => {
  const [hoveredRelic, setHoveredRelic] = useState<number | null>(null);
  const x = useMotionValue(0);

  const displayRelics = useMemo(() => {
    if (foundRelics.length > 0) {
      return foundRelics.map((id) => getRelicInfo(id)).filter(Boolean) as RelicInfo[];
    }
    return RELICS;
  }, [foundRelics]);

  const extendedRelics = useMemo(() => {
    return [...displayRelics, ...displayRelics, ...displayRelics];
  }, [displayRelics]);

  const hoveredRelicInfo = hoveredRelic !== null ? extendedRelics[hoveredRelic] : null;

  const itemWidth = 104;
  const totalWidth = displayRelics.length * itemWidth;

  return (
    <div className="w-full">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gold">Possible Relics</h3>
        <p className="text-sm text-gold/60">Swipe to explore what you might find</p>
      </div>

      <div className="relative h-24 overflow-hidden mb-4 will-change-auto">
        <div className="absolute left-0 top-0 w-8 h-full bg-gradient-to-r from-dark-brown via-dark-brown/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 w-8 h-full bg-gradient-to-l from-dark-brown via-dark-brown/80 to-transparent z-10 pointer-events-none" />

        <div className="relative h-full flex items-center overflow-hidden">
          <motion.div
            className="flex will-change-transform"
            style={{ x }}
            drag="x"
            dragConstraints={{
              left: -totalWidth,
              right: totalWidth,
            }}
            dragElastic={0.1}
            dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
            onDragStart={() => setHoveredRelic(null)}
            dragMomentum={false}
          >
            {extendedRelics.map((relic, index) => (
              <div
                key={`${relic.id}-${index}`}
                onMouseEnter={() => setHoveredRelic(index)}
                onMouseLeave={() => setHoveredRelic(null)}
                onTouchStart={() => setHoveredRelic(index)}
                onTouchEnd={() => setHoveredRelic(null)}
              >
                <RelicCard relic={relic} isHovered={hoveredRelic === index} />
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="h-16 flex items-center justify-center">
        {hoveredRelicInfo ? (
          <motion.div
            className="bg-dark-brown/90 border border-gold/30 rounded-lg p-3 w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-center">
              <h4 className="font-semibold text-gold">{hoveredRelicInfo.name}</h4>
              <p className="text-xs text-gold/60 mt-1">Level {hoveredRelicInfo.level} Relic</p>
            </div>
          </motion.div>
        ) : (
          <div className="text-center text-gold/40 text-sm">Hover over a relic to see details</div>
        )}
      </div>
    </div>
  );
};
