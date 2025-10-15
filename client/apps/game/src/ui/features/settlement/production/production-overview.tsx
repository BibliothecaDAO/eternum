import { SparklesIcon } from "lucide-react";
import type { RealmInfo as RealmInfoType, RelicEffectWithEndTick } from "@bibliothecadao/types";

import { ActiveRelicEffects } from "../../world/components/entities/active-relic-effects";
import { RealmInfo } from "./realm-info";

interface ProductionOverviewProps {
  realm: RealmInfoType;
  activeRelics: RelicEffectWithEndTick[];
  wonderBonus: number;
  hasActivatedWonderBonus: boolean;
}

export const ProductionOverview = ({
  realm,
  activeRelics,
  wonderBonus,
  hasActivatedWonderBonus,
}: ProductionOverviewProps) => {
  return (
    <section className="space-y-3">
      <RealmInfo realm={realm} />
      <ActiveRelicEffects relicEffects={activeRelics} entityId={realm.entityId} />

      {hasActivatedWonderBonus && (
        <div className="relative overflow-hidden rounded-lg border-2 border-gold/30 bg-gradient-to-r from-gold/20 to-gold/5 px-6 py-4 shadow-lg shadow-gold/10">
          <div className="absolute inset-0 opacity-5" />
          <div className="relative">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-gold/20 p-3">
                <SparklesIcon className="h-7 w-7 text-gold" />
              </div>
              <div>
                <h6 className="mb-1 text-lg font-bold text-gold">Wonder Bonus Active</h6>
                <p className="text-sm text-gold/90">
                  ✨ Currently receiving +{((wonderBonus - 1) * 100).toFixed(2)}% production bonus
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
