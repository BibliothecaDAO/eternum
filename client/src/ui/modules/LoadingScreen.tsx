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
  const [backgroundImage, setBackgroundImage] = useState("01");

  useEffect(() => {
    // Get current timestamp in minutes
    const timestamp = Math.floor(Date.now() / (1000 * 60));
    // Get a number between 1-7 based on current minute
    const imageNumber = (timestamp % 7) + 1;
    // Pad with leading zero if needed
    const paddedNumber = imageNumber.toString().padStart(2, "0");
    setBackgroundImage(paddedNumber);

    // Get statement index based on current minute
    const statementIndex = timestamp % statements.length;
    setCurrentStatement(statementIndex);

    // Update statement every minute
    const interval = setInterval(() => {
      const newTimestamp = Math.floor(Date.now() / (1000 * 60));
      setCurrentStatement(newTimestamp % statements.length);
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-screen w-screen bg-brown">
      <img className="absolute h-screen w-screen object-cover" src={`/images/covers/${backgroundImage}.png`} alt="" />
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
