import { Loader2, Swords } from "lucide-react";

interface CombatLoadingProps {
  message?: string;
  className?: string;
}

export const CombatLoading = ({ message = "Calculating battle simulation...", className = "" }: CombatLoadingProps) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <div className="relative">
        <Swords className="w-12 h-12 text-gold/40 animate-pulse" />
        <Loader2 className="absolute -top-2 -right-2 w-6 h-6 text-gold animate-spin" />
      </div>
      <div className="mt-4 text-center">
        <p className="text-gold/80 text-sm">{message}</p>
        <div className="mt-2 flex items-center gap-1">
          <div className="w-1 h-1 bg-gold/60 rounded-full animate-pulse"></div>
          <div className="w-1 h-1 bg-gold/60 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
          <div className="w-1 h-1 bg-gold/60 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
        </div>
      </div>
    </div>
  );
};
