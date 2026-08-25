import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WaveformBackground } from "@/components/WaveformBackground";
import { Game } from "@/data/games";

function BackgroundSlideshow({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className="absolute inset-0">
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={currentIndex}
          className="absolute inset-0 bg-cover bg-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 1.5,
            ease: [0.4, 0, 0.2, 1], // Custom easing function for smoother transition
          }}
          style={{
            backgroundImage: `url(${images[currentIndex]})`,
          }}
        />
        <motion.div
          key={`prev-${currentIndex}`}
          className="absolute inset-0 bg-cover bg-center"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          transition={{
            duration: 1.5,
            ease: [0.4, 0, 0.2, 1],
          }}
          style={{
            backgroundImage: `url(${
              images[(currentIndex - 1 + images.length) % images.length]
            })`,
          }}
        />
      </AnimatePresence>

      {/* Optional: Add slide indicators */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {images.map((_, index) => (
          <motion.div
            key={index}
            className={`w-2 h-2 rounded-full ${
              index === currentIndex ? "bg-primary" : "bg-muted"
            }`}
            initial={{ scale: 0.8 }}
            animate={{ scale: index === currentIndex ? 1 : 0.8 }}
            transition={{ duration: 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

export function AnimatedBackground({
  selectedGame,
}: {
  selectedGame: Game | null;
}) {
  return (
    <div className="absolute inset-0">
      <AnimatePresence initial={false}>
        {selectedGame ? (
          selectedGame.backgroundImages ? (
            <BackgroundSlideshow images={selectedGame.backgroundImages} />
          ) : (
            <motion.div
              key={selectedGame.id}
              className="absolute inset-0 "
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: "easeInOut" }}
              style={{
                backgroundImage: `url(${selectedGame.backgroundImage})`,
              }}
            />
          )
        ) : (
          <WaveformBackground />
        )}
      </AnimatePresence>
    </div>
  );
}
