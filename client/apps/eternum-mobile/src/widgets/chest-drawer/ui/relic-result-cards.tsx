import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { getRelicInfo, RelicInfo } from "@bibliothecadao/types";
import { AnimatePresence, motion } from "framer-motion";

interface RelicResultCardsProps {
  relics: number[];
  revealedCards: number[];
}

const RelicResultCard = ({ relic, index, isRevealed }: { relic: RelicInfo; index: number; isRevealed: boolean }) => {
  const isRare = relic.level >= 2;

  return (
    <AnimatePresence>
      {isRevealed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
            delay: index * 0.1,
          }}
          className="relative"
        >
          <Card
            className={`p-4 bg-dark-brown/90 border-2 transition-all duration-300 ${
              isRare ? "border-purple-400 shadow-lg shadow-purple-400/25" : "border-gold/30 hover:border-gold/50"
            }`}
          >
            {/* Rare Relic Special Effects */}
            {isRare && (
              <motion.div
                className="absolute -inset-1 bg-gradient-to-r from-purple-400/20 via-pink-400/20 to-purple-400/20 rounded-lg"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}

            <div className="relative z-10 flex flex-col items-center space-y-3">
              {/* Relic Icon */}
              <div className="relative">
                <div
                  className={`w-16 h-16 flex items-center justify-center rounded-lg ${
                    isRare ? "bg-purple-500/20" : "bg-gold/10"
                  }`}
                >
                  <ResourceIcon resourceId={relic.id} size={48} showTooltip={false} />
                </div>

                {/* Sparkle effect for rare relics */}
                {isRare && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.7, 1, 0.7],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}
              </div>

              {/* Relic Info */}
              <div className="text-center space-y-1">
                <h4 className="font-semibold text-gold text-sm">{relic.name}</h4>

                <div className="flex justify-center">
                  <Badge
                    variant={isRare ? "destructive" : "secondary"}
                    className={`text-xs ${
                      isRare
                        ? "bg-purple-500/20 text-purple-300 border-purple-400/50"
                        : "bg-gold/10 text-gold border-gold/30"
                    }`}
                  >
                    Level {relic.level}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const RelicResultCards = ({ relics, revealedCards }: RelicResultCardsProps) => {
  const relicInfos = relics.map((id) => getRelicInfo(id)).filter(Boolean) as RelicInfo[];

  if (relics.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gold/60">No relics found in this chest.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gold">🎉 Relics Discovered! 🎉</h3>
        <p className="text-sm text-gold/70 mt-1">
          {relics.length} relic{relics.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Responsive Grid: 1 column on mobile, 2 on tablet+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {relicInfos.map((relic, index) => (
          <RelicResultCard
            key={`result-${relic.id}-${index}`}
            relic={relic}
            index={index}
            isRevealed={revealedCards.includes(index)}
          />
        ))}
      </div>
    </div>
  );
};
