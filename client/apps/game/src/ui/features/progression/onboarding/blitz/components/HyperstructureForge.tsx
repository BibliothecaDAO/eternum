import { configManager } from "@bibliothecadao/eternum";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { buttonVariants, numberVariants, rippleVariants } from "../animations";

interface HyperstructureForgeProps {
  numHyperStructuresLeft: number;
  onForge: () => Promise<void>;
  canMake: boolean;
  className?: string;
}

export const HyperstructureForge = ({
  numHyperStructuresLeft,
  onForge,
  canMake,
  className = "",
}: HyperstructureForgeProps) => {
  const [isForging, setIsForging] = useState(false);
  const [currentCount, setCurrentCount] = useState(numHyperStructuresLeft);

  // Auto-rerender and check config every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const latestBlitzConfig = configManager.getBlitzConfig();
      const latestCount = latestBlitzConfig?.blitz_num_hyperstructures_left;
      if (latestCount !== undefined) {
        setCurrentCount(latestCount);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Update state when prop changes
  useEffect(() => {
    setCurrentCount(numHyperStructuresLeft);
  }, [numHyperStructuresLeft]);

  const handleForge = async () => {
    setIsForging(true);
    try {
      await onForge();
    } catch (error) {
      console.error("Make hyperstructures failed:", error);
    } finally {
      setIsForging(false);
    }
  };

  if (currentCount <= 0 || !canMake) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h3 className="text-gold font-semibold text-sm">Forge Hyperstructures</h3>
      </motion.div>

      {/* Forge Button */}
      <ForgeButton count={currentCount} isLoading={isForging} onClick={handleForge} />
    </div>
  );
};

// Forge button sub-component
const ForgeButton = ({
  count,
  isLoading,
  onClick,
}: {
  count: number;
  isLoading: boolean;
  onClick: () => void;
}) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={isLoading}
      variants={buttonVariants}
      initial="idle"
      whileHover="hover"
      whileTap="tap"
      className="relative w-24 h-24 rounded-full cursor-pointer transform-gpu disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-yellow-300/50"
      style={{
        background: "radial-gradient(circle at 30% 30%, #facc15, #ca8a04, #f59e0b)",
        boxShadow:
          "0 8px 32px rgba(251, 191, 36, 0.4), inset 0 2px 8px rgba(255, 255, 255, 0.4), inset 0 -2px 8px rgba(0, 0, 0, 0.1)",
        border: "4px solid #fef3c7",
        transition: "border-color 0.3s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#ffffff")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#fef3c7")}
    >
      {/* Ripple Effect */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-yellow-400/40"
        variants={rippleVariants}
        animate="pulse"
      />

      {/* Content */}
      <motion.div
        className="flex items-center justify-center w-full h-full text-4xl font-black text-amber-900"
        animate={isLoading ? {} : numberVariants.breathing}
      >
        {isLoading ? (
          <motion.img
            src="/images/logos/eternum-loader.png"
            className="w-8 h-8"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <motion.span key={count} variants={numberVariants} initial="enter" animate="center">
            {count}
          </motion.span>
        )}
      </motion.div>

      {/* Sparkles */}
      {!isLoading && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full"
              style={{
                top: `${20 + i * 20}%`,
                left: `${10 + i * 30}%`,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.5,
                ease: "easeInOut",
              }}
            />
          ))}
        </>
      )}
    </motion.button>
  );
};
