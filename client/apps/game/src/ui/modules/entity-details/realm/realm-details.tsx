import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager, getIsBlitz } from "@bibliothecadao/eternum";

import { HintModalButton } from "@/ui/design-system/molecules/hint-modal-button";
import { HintSection } from "@/ui/features/progression/hints/hint-modal";
import { Castle } from "@/ui/modules/entity-details/realm/castle";
import { copyPlayerAddressToClipboard, displayAddress } from "@/ui/utils/utils";
import {
  formatTime,
  getStructure,
  getStructureImmunityTimer,
  getStructureName,
  isStructureImmune,
  toHexString,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, RealmLevels, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import Button from "@/ui/design-system/atoms/button";
import { ProductionModal } from "@/ui/features/settlement";
import { Crown as CrownIcon } from "lucide-react";

export const RealmVillageDetails = () => {
  const dojo = useDojo();
  const { currentBlockTimestamp } = useBlockTimestamp();
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const structure = useMemo(
    () => getStructure(structureEntityId, ContractAddress(dojo.account.account.address), dojo.setup.components),
    [structureEntityId, dojo.account.account.address, dojo.setup.components],
  );

  const isRealm = useMemo(() => {
    return structure?.structure.base.category === StructureType.Realm;
  }, [structure]);

  const isVillage = useMemo(() => {
    return structure?.structure.base.category === StructureType.Village;
  }, [structure]);

  const address = useMemo(() => {
    return toHexString(structure?.owner || 0n);
  }, [structure]);

  const isImmune = useMemo(() => isStructureImmune(currentBlockTimestamp || 0), [structure, currentBlockTimestamp]);
  const timer = useMemo(
    () => getStructureImmunityTimer(structure?.structure, currentBlockTimestamp || 0),
    [structure, currentBlockTimestamp],
  );

  return (
    structure && (
      <div className="p-3 space-y-4">
        {isImmune && (
          <div
            onMouseEnter={() => {
              setTooltip({
                content: (
                  <>
                    This structure is currently immune to attacks.
                    <br />
                    During this period, you are also unable to attack other players.
                  </>
                ),
                position: "top",
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="h6 text-lg text-green bg-green/10 px-4 py-1.5 rounded-lg animate-pulse"
          >
            Realm is Immune for: {formatTime(timer)}
          </div>
        )}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-2xl font-bold">{getStructureName(structure.structure, getIsBlitz()).name}</h3>
            </div>
            <HintModalButton section={HintSection.Realm} />
          </div>
          <div className="flex justify-between items-center text-xs space-x-4 py-0.5 rounded-lg px-3 h6">
            <div className="uppercase font-medium">{structure.ownerName}</div>
            <span
              className="uppercase hover:text-white cursor-pointer transition-colors"
              onClick={() => copyPlayerAddressToClipboard(structure.owner, structure.ownerName || "")}
            >
              {displayAddress(address)}
            </span>
          </div>
        </div>

        {(isRealm || isVillage) && <Castle />}
      </div>
    )
  );
};

export const RealmUpgradeCompact = () => {
  const dojo = useDojo();
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const isLaborProductionEnabled = configManager.isLaborProductionEnabled();

  const structure = useMemo(
    () => getStructure(structureEntityId, ContractAddress(dojo.account.account.address), dojo.setup.components),
    [structureEntityId, dojo.account.account.address, dojo.setup.components],
  );

  const upgradeInfo = useStructureUpgrade(structureEntityId);

  if (!structure || !upgradeInfo) return null;

  if (upgradeInfo.isMaxLevel) {
    return (
      <div className="p-3 text-sm text-gold/70">
        <div className="flex items-center gap-2">
          <CrownIcon className="h-4 w-4 text-gold" />
          <span className="font-semibold">Max level reached</span>
        </div>
      </div>
    );
  }

  const { nextLevel, missingRequirements, requirements, canUpgrade, handleUpgrade, nextLevelName, isOwner } = upgradeInfo;

  const missingLabel =
    missingRequirements.length > 0
      ? missingRequirements
          .map((req) => `${Math.max(0, Math.ceil(req.amount - req.current)).toLocaleString()} ${ResourcesIds[req.resource] ?? req.resource}`)
          .join(", ")
      : "";

  return (
    <div className="space-y-2">
      <div className="rounded border border-gold/20 bg-black/40 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Labor]} size="sm" />
          <div className="flex flex-col leading-tight">
            <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Labor Production</span>
            <span className="text-sm font-semibold text-gold">+1 /s</span>
          </div>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col leading-tight text-gold">
            <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Upgrade</span>
            <span className="text-sm font-semibold">to {nextLevelName ?? RealmLevels[nextLevel]}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col leading-tight">
              <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Missing</span>
              <span className="text-xxs font-semibold text-red-300">
                {missingRequirements.length > 0 ? missingLabel : "None"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {requirements.map((req) => {
            const isMet = req.current >= req.amount;
            return (
              <div
                key={`${req.resource}-${req.amount}`}
                className={`flex items-center gap-2 rounded border px-2 py-1 ${
                  isMet ? "border-gold/15 bg-gold/5" : "border-red-400/40 bg-red-500/5"
                }`}
              >
                <ResourceIcon resource={ResourcesIds[req.resource]} size="sm" />
                <div className={`text-xs ${isMet ? "text-gold" : "text-red-300"}`}>
                  <span className="font-semibold">{Math.floor(req.current).toLocaleString()}</span>
                  <span className={isMet ? "text-gold/50" : "text-red-200/70"}> / {req.amount.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
        {isOwner && (
          <Button
            variant={canUpgrade ? "gold" : "outline"}
            size="sm"
            className="w-full"
            disabled={!canUpgrade}
            onClick={handleUpgrade}
          >
            {canUpgrade ? "Upgrade" : "Need resources"}
          </Button>
        )}
      </div>
    </div>
  );
};
