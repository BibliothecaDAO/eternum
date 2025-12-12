import { MaybeController } from "../MaybeController";

export const MarketCreatedBy = ({ creator }: { creator?: string }) => {
  if (!creator) return null;

  return (
    <div className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-gold/70 shadow-inner">
      <div className="text-xs uppercase tracking-[0.08em] text-gold/60">Market creator</div>
      <div className="mt-1 text-white">
        <MaybeController address={creator} />
      </div>
    </div>
  );
};
