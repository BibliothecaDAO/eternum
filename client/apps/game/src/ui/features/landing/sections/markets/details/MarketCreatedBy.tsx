import { MaybeController } from "../MaybeController";

export const MarketCreatedBy = ({ creator }: { creator?: string }) => {
  if (!creator) return null;

  return (
    <div className="text-xs text-gold/70">
      Created by <MaybeController address={creator} />
    </div>
  );
};
