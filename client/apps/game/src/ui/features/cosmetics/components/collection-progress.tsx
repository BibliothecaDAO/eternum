interface CollectionProgressProps {
  ownedCount: number;
  totalCount: number;
  isLoading?: boolean;
}

export const CollectionProgress = ({ ownedCount, totalCount, isLoading = false }: CollectionProgressProps) => {
  const percentage = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-gold/20 bg-black/40 px-4 py-3">
        <div className="h-2 flex-1 animate-pulse rounded-full bg-gold/10" />
        <div className="h-4 w-24 animate-pulse rounded bg-gold/10" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gold/20 bg-black/40 px-4 py-3">
      <div className="flex-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gold/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <div className="flex items-baseline gap-1 text-sm">
        <span className="font-semibold text-gold">{ownedCount}</span>
        <span className="text-gold/50">/</span>
        <span className="text-gold/70">{totalCount}</span>
        <span className="ml-1 text-xs text-gold/40">({percentage}%)</span>
      </div>
    </div>
  );
};
