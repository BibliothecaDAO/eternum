import { formatBiomeBonus } from "@/ui/features/military";
import { ActionPath, configManager, getGuardsByStructure, getBlockTimestamp } from "@bibliothecadao/eternum";
import { useDojo, useStaminaManager } from "@bibliothecadao/react";
import {
  getExplorerFromToriiClient,
  getStructureFromToriiClient,
} from "@bibliothecadao/torii";
import { BiomeType, ClientComponents, ID, TroopType } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import { memo, useEffect, useMemo, useState } from "react";

import { InfoLabel } from "./info-label";

interface AttackInfoProps {
  selectedEntityId: ID;
  path: ActionPath[];
}

export const AttackInfo = memo(({ selectedEntityId, path }: AttackInfoProps) => {
  const {
    network: { toriiClient },
  } = useDojo();
  const { currentArmiesTick } = getBlockTimestamp();

  const [explorer, setExplorer] = useState<ComponentValue<ClientComponents["ExplorerTroops"]["schema"]> | undefined>(
    undefined,
  );
  const [structure, setStructure] = useState<ComponentValue<ClientComponents["Structure"]["schema"]> | undefined>(
    undefined,
  );

  useEffect(() => {
    const fetchExplorer = async () => {
      const explorerResult = await getExplorerFromToriiClient(toriiClient, selectedEntityId);
      setExplorer(explorerResult?.explorer);
    };
    fetchExplorer();
  }, [selectedEntityId, toriiClient]);

  useEffect(() => {
    const fetchStructure = async () => {
      if (!explorer) return;
      const result = await getStructureFromToriiClient(toriiClient, explorer.owner);
      if (result) {
        setStructure(result.structure);
      }
    };
    fetchStructure();
  }, [explorer, toriiClient]);

  const targetTroops = useMemo(() => {
    if (explorer) return explorer.troops;
    return structure ? getGuardsByStructure(structure)[0]?.troops : undefined;
  }, [explorer, structure]);

  const staminaManager = useStaminaManager(selectedEntityId);
  const stamina = useMemo(() => {
    if (!targetTroops) return { amount: 0n, updated_tick: 0n };
    return staminaManager.getStamina(currentArmiesTick);
  }, [targetTroops, currentArmiesTick, staminaManager]);

  const combatParams = useMemo(() => configManager.getCombatConfig(), []);

  const targetBiome = useMemo(() => {
    return path[path.length - 1].biomeType || BiomeType.Grassland;
  }, [path]);

  const hasEnoughStamina = useMemo(() => {
    const requiredStamina = combatParams.stamina_attack_req;
    return Number(stamina.amount) >= requiredStamina;
  }, [stamina, combatParams]);

  const biomeAdvantages = useMemo(() => {
    return {
      knight: configManager.getBiomeCombatBonus(TroopType.Knight, targetBiome),
      paladin: configManager.getBiomeCombatBonus(TroopType.Paladin, targetBiome),
      crossbowman: configManager.getBiomeCombatBonus(TroopType.Crossbowman, targetBiome),
    };
  }, [targetBiome]);

  return (
    <div className="mt-2 flex flex-col gap-3 text-xs">
      <InfoLabel variant="attack" className="items-center gap-3">
        <span className="text-2xl leading-none">⚡️</span>
        <div className="flex flex-col gap-1 text-left normal-case">
          <span className="text-xxs uppercase tracking-wide opacity-80">Stamina Check</span>
          <div className="flex items-center gap-2 text-xs font-normal">
            <span className={clsx(hasEnoughStamina ? "text-green-400" : "text-red-400", "text-sm font-bold")}>({
              Number(stamina.amount)
            })</span>
            <span>
              {hasEnoughStamina
                ? "Enough stamina to attack"
                : `Need ${combatParams.stamina_attack_req} stamina to attack`}
            </span>
          </div>
        </div>
      </InfoLabel>

      <InfoLabel variant="default" className="flex-col items-start gap-3 text-left normal-case">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">🌍</span>
          <div className="flex flex-col">
            <span className="text-xxs uppercase tracking-wide opacity-80">Target Biome</span>
            <span className="text-xs font-semibold normal-case">{targetBiome}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs font-medium">
          <span className="text-xxs uppercase tracking-wide opacity-80">Troop Type</span>
          <span className="text-xxs uppercase tracking-wide opacity-80">Biome Bonus</span>

          {targetTroops?.category === TroopType.Knight && (
            <span className="font-bold text-gold">Knight (Your Army)</span>
          )}
          {targetTroops?.category !== TroopType.Knight && <span>Knight</span>}
          <span className="text-sm">{formatBiomeBonus(biomeAdvantages.knight)}</span>

          {targetTroops?.category === TroopType.Paladin && (
            <span className="font-bold text-gold">Paladin (Your Army)</span>
          )}
          {targetTroops?.category !== TroopType.Paladin && <span>Paladin</span>}
          <span className="text-sm">{formatBiomeBonus(biomeAdvantages.paladin)}</span>

          {targetTroops?.category === TroopType.Crossbowman && (
            <span className="font-bold text-gold">Crossbowman (Your Army)</span>
          )}
          {targetTroops?.category !== TroopType.Crossbowman && <span>Crossbowman</span>}
          <span className="text-sm">{formatBiomeBonus(biomeAdvantages.crossbowman)}</span>
        </div>

        {targetTroops?.category && (
          <InfoLabel variant="mine" className="flex-col items-start gap-1 text-left normal-case">
            <span className="text-xxs uppercase tracking-wide opacity-80">Your Army's Biome Effect</span>
            <div className="flex items-center gap-2 text-xs font-medium">
              <span>
                {
                  formatBiomeBonus(
                    biomeAdvantages[targetTroops.category.toLowerCase() as keyof typeof biomeAdvantages],
                  )
                }
              </span>
              <span>
                {biomeAdvantages[targetTroops.category.toLowerCase() as keyof typeof biomeAdvantages] > 1
                  ? "Advantage in this biome"
                  : biomeAdvantages[targetTroops.category.toLowerCase() as keyof typeof biomeAdvantages] < 1
                    ? "Disadvantage in this biome"
                    : "Neutral in this biome"}
              </span>
            </div>
          </InfoLabel>
        )}
      </InfoLabel>
    </div>
  );
});
