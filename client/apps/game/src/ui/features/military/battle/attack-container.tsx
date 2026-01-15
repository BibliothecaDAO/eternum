import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useState } from "react";

import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";

import type { ID } from "@bibliothecadao/types";

import { CombatContainer } from "./combat-container";
import { useAttackTargetData } from "./hooks/use-attack-target";
import { RaidContainer } from "./raid-container";

enum AttackType {
  Combat,
  Raid,
}

export const AttackContainer = ({
  attackerEntityId,
  targetHex,
}: {
  attackerEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  const [attackType, setAttackType] = useState<AttackType>(AttackType.Combat);
  const mode = useGameModeConfig();

  const { attackerRelicEffects, targetRelicEffects, target, targetResources, isLoading } = useAttackTargetData(
    attackerEntityId,
    targetHex,
  );

  return (
    <div className="flex flex-col h-full">
      {isLoading ? (
        <LoadingAnimation />
      ) : (
        <>
          <div className="flex justify-center mb-6 mx-auto mt-4">
            {mode.ui.showAttackTypeSelector && (
              <div className="flex rounded-md overflow-hidden border border-gold/30 shadow-lg">
                <button
                  className={`px-8 py-3 text-lg font-semibold transition-all duration-200 ${
                    attackType === AttackType.Combat
                      ? "bg-gold/20 text-gold border-b-2 border-gold"
                      : "bg-dark-brown text-gold/70 hover:text-gold hover:bg-brown-900/50"
                  }`}
                  onClick={() => setAttackType(AttackType.Combat)}
                >
                  <div className="flex items-center">
                    <span className="mr-2">⚔️</span>
                    Combat
                  </div>
                </button>
                <button
                  className={`px-8 py-3 text-lg font-semibold transition-all duration-200 ${
                    attackType === AttackType.Raid
                      ? "bg-gold/20 text-gold border-b-2 border-gold"
                      : "bg-dark-brown text-gold/70 hover:text-gold hover:bg-brown-900/50"
                  }`}
                  onClick={() => setAttackType(AttackType.Raid)}
                >
                  <div className="flex items-center">
                    <span className="mr-2">💰</span>
                    Raid
                  </div>
                </button>
              </div>
            )}
          </div>

          {target ? (
            <div className="flex-grow overflow-y-auto">
              {attackType === AttackType.Combat ? (
                <CombatContainer
                  attackerEntityId={attackerEntityId}
                  target={target}
                  targetResources={targetResources}
                  attackerActiveRelicEffects={attackerRelicEffects}
                  targetActiveRelicEffects={targetRelicEffects}
                />
              ) : (
                <RaidContainer
                  attackerEntityId={attackerEntityId}
                  target={target}
                  targetResources={targetResources}
                  attackerActiveRelicEffects={attackerRelicEffects}
                  targetActiveRelicEffects={targetRelicEffects}
                />
              )}
            </div>
          ) : (
            <div className="flex-grow overflow-y-auto">
              <div className="text-gold/70 text-sm">No target found</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
