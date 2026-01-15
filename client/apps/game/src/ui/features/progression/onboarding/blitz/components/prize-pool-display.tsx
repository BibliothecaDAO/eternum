import { motion } from "framer-motion";
import { ExternalLink, Loader2, Trophy } from "lucide-react";
import { usePrizePoolBalance } from "../hooks";

const formatPrizePoolBalance = (balance: bigint): string => {
  const formatted = Number(balance) / 1e18;
  return formatted.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export const PrizePoolDisplay = () => {
  const { prizePoolBalance, prizePoolAddress, isLoading, isMainnet, voyagerUrl } = usePrizePoolBalance();

  if (!isMainnet || !prizePoolAddress) {
    return null;
  }

  const handleClick = () => {
    window.open(voyagerUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleClick}
      className="bg-gold/10 border border-gold/30 rounded-lg p-4 cursor-pointer hover:bg-gold/20 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-gold" />
          <span className="text-gold font-semibold">Prize Pool</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gold/50" />
          ) : (
            <>
              <span className="text-gold font-bold text-lg">{formatPrizePoolBalance(prizePoolBalance)}</span>
              <span className="text-gold/70 text-sm">LORDS</span>
            </>
          )}
          <ExternalLink className="w-4 h-4 text-gold/50" />
        </div>
      </div>
    </motion.div>
  );
};
