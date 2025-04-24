import { ID } from "@bibliothecadao/types";
import { useState } from "react";
import { CombatContainer } from "./combat-container";
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

  return (
    <div className="flex flex-col h-full">
      {/* Attack Type Selection */}
      <div className="flex justify-center mb-6 mx-auto mt-4">
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
      </div>

      {/* Attack Type Description */}
      <div className="text-center mb-4 px-6">
        <p className="text-gold/70 text-sm">
          {attackType === AttackType.Combat
            ? "Combat mode allows you to attack and defeat enemy troops to claim territory."
            : "Raid mode allows you to steal resources from structures without necessarily defeating all troops."}
        </p>
      </div>

      {/* Attack Content */}
      <div className="flex-grow overflow-y-auto">
        {attackType === AttackType.Combat ? (
          <CombatContainer attackerEntityId={attackerEntityId} targetHex={targetHex} />
        ) : (
          <RaidContainer attackerEntityId={attackerEntityId} targetHex={targetHex} />
        )}
      </div>
    </div>
  );
};
