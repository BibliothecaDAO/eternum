import { ProgressCircle } from "@/shared/ui/progress-circle";
import { motion } from "framer-motion";

interface ChestInteractionProps {
  clickCount: number;
  isShaking: boolean;
  isOpening: boolean;
  showResult: boolean;
  onChestClick: () => void;
}

export const ChestInteraction = ({
  clickCount,
  isShaking,
  isOpening,
  showResult,
  onChestClick,
}: ChestInteractionProps) => {
  const progress = (clickCount / 5) * 100;
  const shakeIntensity = Math.min(clickCount * 2, 10);

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="relative">
        <motion.div
          className="relative cursor-pointer select-none"
          animate={{
            scale: isOpening ? [1, 1.1, 1] : 1,
            rotate: isShaking ? [-shakeIntensity, shakeIntensity, -shakeIntensity, 0] : 0,
          }}
          transition={{
            scale: { duration: 0.6, ease: "easeInOut" },
            rotate: { duration: 0.3, ease: "easeInOut" },
          }}
          onClick={onChestClick}
          whileTap={{ scale: 0.95 }}
        >
          {/* Chest Image */}
          <div className="w-32 h-32 relative">
            <img
              src={
                isOpening || showResult
                  ? "/images/relic-chest/chest-opened.png"
                  : "/images/relic-chest/chest-closed.png"
              }
              alt="Treasure Chest"
              className="w-full h-full object-contain"
            />

            {/* Crack Overlay */}
            {clickCount > 0 && !isOpening && !showResult && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-transparent via-red-900/30 to-red-800/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: Math.min(clickCount * 0.2, 0.8) }}
                style={{
                  backgroundImage: `linear-gradient(45deg, transparent 40%, rgba(139, 69, 19, ${Math.min(clickCount * 0.15, 0.6)}) 50%, transparent 60%)`,
                }}
              />
            )}

            {/* Opening Flash Effect */}
            {isOpening && (
              <motion.div
                className="absolute inset-0 bg-white"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            )}
          </div>

          {/* Sparkle Particles */}
          {clickCount > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: Math.min(clickCount * 2, 8) }).map((_, i) => (
                <motion.div
                  key={`sparkle-${clickCount}-${i}`}
                  className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                  initial={{
                    x: "50%",
                    y: "50%",
                    scale: 0,
                    opacity: 1,
                  }}
                  animate={{
                    x: `${50 + (Math.random() - 0.5) * 200}%`,
                    y: `${50 + (Math.random() - 0.5) * 200}%`,
                    scale: [0, 1, 0],
                    opacity: [1, 1, 0],
                  }}
                  transition={{
                    duration: 1,
                    ease: "easeOut",
                  }}
                  style={{
                    left: Math.random() * 128,
                    top: Math.random() * 128,
                  }}
                />
              ))}
            </div>
          )}

          {/* Light Beam Effects for High Click Counts */}
          {clickCount >= 3 && (
            <motion.div
              className="absolute -inset-4 bg-gradient-radial from-yellow-300/20 via-yellow-400/10 to-transparent rounded-full"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
        </motion.div>

        {/* Click Number Feedback */}
        {clickCount > 0 && (
          <motion.div
            key={`click-${clickCount}`}
            className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-2xl font-bold text-yellow-300"
            initial={{ scale: 0, y: 0, opacity: 1 }}
            animate={{ scale: [0, 1.2, 1], y: -20, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {clickCount}
          </motion.div>
        )}
      </div>

      {/* Progress Indicator */}
      <div className="flex flex-col items-center space-y-2">
        <ProgressCircle progress={progress} size="lg" />
        <p className="text-sm text-gold/70">{clickCount < 5 ? `${5 - clickCount} clicks remaining` : "Opening..."}</p>
      </div>

      {/* Instructions */}
      {!isOpening && !showResult && (
        <motion.div
          className="text-center space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-gold font-medium">Tap the chest to open it!</p>
          <p className="text-xs text-gold/60">Requires 5 taps to unlock</p>
        </motion.div>
      )}
    </div>
  );
};
