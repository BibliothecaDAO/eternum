import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import "../../index.css";

export const LoadingScreen = () => {
  const statements = [
    "Syncing Eternum...",
    "Gathering Dragonhide...",
    "Stepping the world...",
    "Painting the Sky...",
    "Crafting Stories...",
    "Harvesting Wood...",
    "Cooking Donkeys...",
    "Preparing Surprises...",
    "Forging Adamantine...",
    "Summoning Paladins...",
    "Enchanting Hartwood...",
    "Mining Deep Crystal...",
    "Cultivating Wheat Fields...",
    "Smelting Cold Iron...",
    "Training Crossbowmen...",
    "Extracting Ethereal Silica...",
    "Polishing Twilight Quartz...",
    "Awakening Ancient Spirits...",
  ];

  const [currentStatement, setCurrentStatement] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStatement((prev) => (prev + 1) % statements.length);
    }, 3000); // Change statement every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-screen w-screen bg-brown">
      <img className="absolute h-screen w-screen object-cover" src="/images/cover.png" alt="" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl text-center bg-brown/90 rounded-xl p-10 border border-gradient bg-hex-bg min-w-96 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStatement}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="animatedBackground"
          >
            {statements[currentStatement]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
