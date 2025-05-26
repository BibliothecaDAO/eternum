import { useRef } from "react";
import { motion } from "framer-motion";
import { games } from "@/data/games";
import { useNavigate } from "@tanstack/react-router";

export function GamesSection() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft += 424; // 400px (card width) + 24px (spacing)
    }
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft -= 424; // 400px (card width) + 24px (spacing)
    }
  };

  const handleGameClick = (gameSlug: string) => {
    navigate({ to: `/games/${gameSlug}` });
  };

  return (
    <section className="relative z-10 transition-all duration-500 mt-6 sm:mt-8 md:mt-20">
      <div className="container mx-auto px-1 sm:px-2 md:px-4 mb-3 sm:mb-4 md:mb-8">
        <motion.h2
          className="text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2 md:mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Featured Games
        </motion.h2>
      </div>
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="relative">
          <div
            className="flex space-x-3 sm:space-x-4 md:space-x-6 overflow-x-auto scrollbar-hide py-2 sm:py-4 px-1 sm:px-2 md:px-4 scroll-smooth"
            ref={scrollContainerRef}
            style={{ scrollBehavior: "smooth" }}
          >
            {games.map((game, index) => (
              <motion.div
                key={game.id}
                layoutId={`game-${game.id}`}
                className="game-tile flex-shrink-0 w-[240px] sm:w-[320px] md:w-[400px] relative aspect-video bg-card overflow-hidden 
                  hover:ring-2 hover:ring-primary transition-all cursor-pointer rounded-md sm:rounded-lg"
                onClick={() => handleGameClick(game.slug)}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  type: "spring",
                  damping: 20,
                  stiffness: 100,
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.img
                  src={game.image}
                  alt={game.title}
                  className="w-full h-full object-cover"
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5 }}
                />
                {/* Status and Player Count Overlay - Top */}
                {game.isLive && (
                  <div className="absolute top-2 sm:top-4 left-2 sm:left-4 flex items-center space-x-2">
                    <motion.div
                      className="flex items-center bg-card/80 backdrop-blur-sm px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 + 0.3 }}
                    >
                      <motion.div
                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-positive mr-1 sm:mr-2"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="text-xs sm:text-sm font-medium text-foreground">
                        Live
                      </span>
                    </motion.div>
                  </div>
                )}

                {/* Title and Player Count Overlay - Bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-2 md:p-4 bg-gradient-to-t from-background/90 to-transparent">
                  <motion.div
                    className="space-y-0.5 sm:space-y-1 md:space-y-2"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                  >
                    <h2 className="text-sm sm:text-base md:text-lg font-semibold text-foreground">
                      {game.title}
                    </h2>
                    {game.players && (
                      <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-2.5 h-2.5 sm:w-3 md:w-4 mr-1"
                        >
                          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                        </svg>
                        {game.players.toLocaleString()} players
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 hover:bg-muted/70 backdrop-blur-sm p-1 sm:p-1.5 md:p-2 rounded-full transition-all duration-300 z-10 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 sm:w-6 sm:h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 hover:bg-muted/70 backdrop-blur-sm p-1 sm:p-1.5 md:p-2 rounded-full transition-all duration-300 z-10 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 sm:w-6 sm:h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>
      </motion.div>
    </section>
  );
}
