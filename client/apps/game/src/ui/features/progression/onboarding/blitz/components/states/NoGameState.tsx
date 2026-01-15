import Button from "@/ui/design-system/atoms/button";
import { motion } from "framer-motion";
import { Calendar, Eye, Search } from "lucide-react";
import { fadeInUp } from "../../animations";
import { CountdownTimer } from "../CountdownTimer";

interface NoGameStateProps {
  nextGameStart?: number;
  onSelectGame?: () => void;
  onSpectate?: () => void;
  className?: string;
}

export const NoGameState = ({ nextGameStart, onSelectGame, onSpectate, className = "" }: NoGameStateProps) => {
  const hasUpcoming = nextGameStart && nextGameStart > Date.now() / 1000;

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className={`space-y-6 text-center ${className}`}
    >
      {/* Empty state illustration */}
      <div className="py-8">
        <div className="relative inline-block">
          <Calendar className="w-16 h-16 mx-auto text-gold/40" />
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 bg-gold/30 rounded-full"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>

        <h3 className="text-xl font-bold text-gold mt-4">No Active Games</h3>
        <p className="text-gold/70 mt-2 max-w-xs mx-auto">
          {hasUpcoming
            ? "A new game is starting soon. Get ready to join the battle!"
            : "Check back later or browse factory games to find an active match."}
        </p>
      </div>

      {/* Next game countdown */}
      {hasUpcoming && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gold/10 border border-gold/30 rounded-lg p-4"
        >
          <p className="text-sm text-gold/70 mb-2">Next game starts in</p>
          <CountdownTimer targetTime={nextGameStart} showLabel={false} size="lg" />
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 justify-center pt-2">
        {onSelectGame && (
          <Button onClick={onSelectGame} variant="primary" size="md" forceUppercase={false}>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span>Browse Games</span>
            </div>
          </Button>
        )}

        {onSpectate && (
          <Button onClick={onSpectate} variant="outline" size="md" forceUppercase={false}>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span>Spectate</span>
            </div>
          </Button>
        )}
      </div>

      {/* Helpful tips */}
      <div className="pt-4 border-t border-gold/10">
        <p className="text-xs text-gold/50">
          Blitz games are short, intense matches. Registration opens before each game starts.
        </p>
      </div>
    </motion.div>
  );
};
