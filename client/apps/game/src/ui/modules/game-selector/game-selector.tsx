import { useGameSelector } from "@/hooks/helpers/use-game-selector";
import { Globe } from "lucide-react";

export const GameSelector = () => {
  const { activeWorld, selectGame } = useGameSelector();

  return (
    <div className="relative">
      <button
        onClick={() => selectGame({ navigateAfter: true, navigateTo: "/play" })}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brown/80 border border-gold/30 hover:bg-brown/90 hover:border-gold/50 transition-all duration-200 text-gold text-sm"
      >
        <Globe className="w-4 h-4" />
        <span className="font-semibold">{activeWorld || "Select Game"}</span>
      </button>
    </div>
  );
};
