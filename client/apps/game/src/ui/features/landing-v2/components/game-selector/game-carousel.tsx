import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useCallback, useState } from "react";
import { EmptyStateCard } from "./empty-state-card";
import { GameCard, type GameInfo } from "./game-card";

interface GameCarouselProps {
  games: GameInfo[];
  onEnterGame: (game: GameInfo) => void;
  onJoinSeason: () => void;
  onGameChange?: (game: GameInfo) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Carousel component for cycling through available games/realms.
 * Shows empty state when no games are available.
 */
export const GameCarousel = ({
  games,
  onEnterGame,
  onJoinSeason,
  onGameChange,
  isLoading = false,
  className,
}: GameCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentGame = games[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < games.length - 1;

  const handlePrev = useCallback(() => {
    if (!hasPrev) return;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    onGameChange?.(games[newIndex]);
  }, [currentIndex, games, hasPrev, onGameChange]);

  const handleNext = useCallback(() => {
    if (!hasNext) return;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    onGameChange?.(games[newIndex]);
  }, [currentIndex, games, hasNext, onGameChange]);

  const handleEnter = useCallback(() => {
    if (currentGame) {
      onEnterGame(currentGame);
    }
  }, [currentGame, onEnterGame]);

  // Empty state - no games
  if (games.length === 0) {
    return (
      <div className={cn("flex flex-col items-center", className)}>
        <EmptyStateCard onJoin={onJoinSeason} isLoading={isLoading} />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Game card */}
      <GameCard
        game={currentGame}
        onEnter={handleEnter}
        onPrev={handlePrev}
        onNext={handleNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isLoading={isLoading}
      />

      {/* Pagination dots */}
      {games.length > 1 && (
        <div className="mt-6 flex items-center gap-2">
          {games.map((game, index) => (
            <button
              key={game.id}
              type="button"
              onClick={() => {
                setCurrentIndex(index);
                onGameChange?.(games[index]);
              }}
              className={cn(
                "h-2 w-2 rounded-full transition-all duration-200",
                index === currentIndex ? "w-4 bg-gold" : "bg-gold/30 hover:bg-gold/50",
              )}
              aria-label={`Go to game ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
