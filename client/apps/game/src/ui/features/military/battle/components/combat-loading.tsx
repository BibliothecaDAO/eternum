import { Loader2, Swords } from "lucide-react";

interface CombatLoadingProps {
  message?: string;
  className?: string;
}

export const CombatLoading = ({ 
  message = "Calculating battle simulation...", 
  className = "" 
}: CombatLoadingProps) => {
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
          <div className="w-1 h-1 bg-gold/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1 h-1 bg-gold/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
};

export const CombatSkeleton = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header Skeleton */}
      <div className="h-8 bg-gold/20 rounded-lg animate-pulse"></div>
      
      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 bg-gold/20 rounded animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gold/10 rounded animate-pulse"></div>
              <div className="h-4 bg-gold/10 rounded animate-pulse w-3/4"></div>
              <div className="h-4 bg-gold/10 rounded animate-pulse w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Battle Prediction Skeleton */}
      <div className="space-y-3">
        <div className="h-6 bg-gold/20 rounded animate-pulse"></div>
        <div className="h-8 bg-gold/10 rounded animate-pulse"></div>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gold/10 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
      
      {/* Button Skeleton */}
      <div className="h-12 bg-gold/20 rounded-lg animate-pulse"></div>
    </div>
  );
};