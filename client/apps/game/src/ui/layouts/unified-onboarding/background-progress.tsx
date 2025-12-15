import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BackgroundProgressProps {
  progress: number;
  isRunning: boolean;
  currentTask: string | null;
  visible: boolean;
}

export const BackgroundProgress = ({ progress, isRunning, currentTask, visible }: BackgroundProgressProps) => {
  return (
    <AnimatePresence>
      {visible && isRunning && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-4 left-4 right-4"
        >
          <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-gold/20 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-gold/70 mb-2">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                {currentTask || "Preparing..."}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-gold/10">
              <motion.div
                className="h-1 rounded-full bg-gold/50"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
