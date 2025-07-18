import { useUIStore } from "@/hooks/store/use-ui-store";
import { ClockIcon } from "@radix-ui/react-icons";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export const GameEndCountdown = () => {
  const seasonEndAt = useUIStore((state) => state.gameEndAt);
  const seasonStartMainAt = useUIStore((state) => state.gameStartMainAt);
  const [timeLeft, setTimeLeft] = useState("");
  const [seasonEnded, setSeasonEnded] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!seasonEndAt || !seasonStartMainAt) {
      setTimeLeft("");
      return;
    }

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setNow(now);

      const diff = seasonEndAt - now;

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        setSeasonEnded(true);
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [seasonEndAt, seasonStartMainAt]);

  if (!timeLeft) {
    return null;
  }

  return (
    <>
      {now >= seasonStartMainAt! && (
        <motion.div drag dragMomentum={false} className="absolute top-20 left-1/2 -translate-x-1/2 z-50 cursor-move">
          <div className="flex items-center p-2 bg-black/80 border border-amber-400/50 rounded-lg text-amber-400 shadow-lg animate-pulse">
            <ClockIcon className="mr-2" />
            {seasonEnded ? (
              <div className="font-bold text-sm tracking-widest">GAME ENDED. SEE YOU AT THE NEXT ONE!</div>
            ) : (
              <div className="font-bold text-sm tracking-widest">GAME ENDS IN: {timeLeft}</div>
            )}
          </div>
        </motion.div>
      )}
    </>
  );
};
