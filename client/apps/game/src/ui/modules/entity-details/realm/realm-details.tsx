import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";

import { HintModalButton } from "@/ui/design-system/molecules/hint-modal-button";
import { HintSection } from "@/ui/features/progression/hints/hint-modal";
import { Castle } from "@/ui/modules/entity-details/realm/castle";
import { copyPlayerAddressToClipboard, displayAddress } from "@/ui/utils/utils";
import {
  formatTime,
  getStructure,
  getStructureImmunityTimer,
  isStructureImmune,
  toHexString,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, RealmLevels, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatIncomingEta, useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import ChevronsUp from "lucide-react/dist/esm/icons/chevrons-up";
import CrownIcon from "lucide-react/dist/esm/icons/crown";

// One chip style for every requirement / produces row — matches the
// building-tile inspector so the castle reads with the same vocabulary.
const CHIP_BASE =
  "flex items-center gap-1 rounded border border-gold/20 bg-black/40 px-1.5 py-1 text-[11px] font-semibold tabular-nums";

const SectionRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <span className={HUD_LABEL}>{label}</span>
    <div className="flex flex-wrap items-center gap-1.5">{children}</div>
  </div>
);

const RealmVillageDetails = () => {
  const dojo = useDojo();
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const mode = useGameModeConfig();

  const structure = useMemo(
    () => getStructure(structureEntityId, ContractAddress(dojo.account.account.address), dojo.setup.components),
    [structureEntityId, dojo.account.account.address, dojo.setup.components],
  );

  const isRealm = useMemo(() => {
    return structure?.structure.base.category === StructureType.Realm;
  }, [structure]);

  const isVillageLike = useMemo(() => {
    return isVillageLikeStructureCategory(structure?.structure.base.category);
  }, [structure]);

  const structureName = useMemo(() => {
    return structure ? mode.structure.getName(structure.structure).name : "Structure";
  }, [mode, structure]);

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
            {structureName} is Immune for: {formatTime(timer)}
          </div>
        )}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-2xl font-bold">{structureName}</h3>
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

        {(isRealm || isVillageLike) && <Castle />}
      </div>
    )
  );
};

export const RealmUpgradeCompact = () => {
  const dojo = useDojo();
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const structure = useMemo(
    () => getStructure(structureEntityId, ContractAddress(dojo.account.account.address), dojo.setup.components),
    [structureEntityId, dojo.account.account.address, dojo.setup.components],
  );

  const upgradeInfo = useStructureUpgrade(structureEntityId);

  if (!structure || !upgradeInfo) return null;

  if (upgradeInfo.isMaxLevel) {
    return (
      <div className="flex flex-col gap-2.5">
        <SectionRow label="Labor / sec">
          <span className={CHIP_BASE} title="Labor Production">
            <span className="text-emerald-300">+1</span>
            <ResourceIcon withTooltip={false} resource={ResourcesIds[ResourcesIds.Labor]} size="xs" />
          </span>
        </SectionRow>
        <SectionRow label="Upgrade">
          <span className={CHIP_BASE} title="Max level reached">
            <CrownIcon className="h-3.5 w-3.5 text-gold" />
            <span className="text-gold">Max</span>
          </span>
        </SectionRow>
      </div>
    );
  }

  const { nextLevel, requirements, canUpgrade, handleUpgrade, nextLevelName, isOwner } = upgradeInfo;

  const onUpgrade = () => {
    if (!canUpgrade || upgradeInfo.isUpgradeLocked || !isOwner) return;

    void handleUpgrade().catch((error) => {
      console.error("Failed to upgrade realm", error);
    });
  };

  const resolvedNextLevel = nextLevel != null ? RealmLevels[nextLevel as RealmLevels] : null;
  const upgradeTargetLabel = nextLevelName ?? resolvedNextLevel ?? "Next level";
  const upgradeBlockedReason = upgradeInfo.isUpgradeLocked ? "Waiting for sync" : "Need resources";

  return (
    <div className="flex flex-col gap-2.5">
      <SectionRow label="Labor / sec">
        <span className={CHIP_BASE} title="Labor Production">
          <span className="text-emerald-300">+1</span>
          <ResourceIcon withTooltip={false} resource={ResourcesIds[ResourcesIds.Labor]} size="xs" />
        </span>
      </SectionRow>

      <SectionRow label={`Upgrade to ${upgradeTargetLabel}`}>
        {requirements.map((req) => {
          const isMet = req.current >= req.amount;
          const incomingTitle = req.incoming
            ? ` (+${Math.floor(req.incoming.amount).toLocaleString()} in transit, ${formatIncomingEta(req.incoming.etaSeconds)})`
            : "";
          return (
            <span
              key={`${req.resource}-${req.amount}`}
              className={CHIP_BASE}
              title={`${ResourcesIds[req.resource] ?? `Resource ${req.resource}`} — need ${req.amount.toLocaleString()}${incomingTitle}`}
            >
              <ResourceIcon withTooltip={false} resource={ResourcesIds[req.resource]} size="xs" />
              <span className={isMet ? "text-gold" : "text-red-300"}>{Math.floor(req.current).toLocaleString()}</span>
              <span className={isMet ? "text-gold/55" : "text-red-300/80"}>/ {req.amount.toLocaleString()}</span>
              {req.incoming && <span className="text-emerald-300/90">↑</span>}
            </span>
          );
        })}
      </SectionRow>

      {isOwner && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={onUpgrade}
            disabled={!canUpgrade || upgradeInfo.isUpgradeLocked}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md border px-3 text-[10px] font-semibold uppercase tracking-[0.16em] shadow transition",
              canUpgrade
                ? "border-amber-500/80 bg-amber-400/90 text-black hover:bg-amber-300"
                : "border-gold/20 bg-black/40 text-gold/40 cursor-not-allowed",
            )}
            title={canUpgrade ? "Upgrade castle" : upgradeBlockedReason}
            aria-label={canUpgrade ? "Upgrade castle" : upgradeBlockedReason}
          >
            <ChevronsUp className="h-3.5 w-3.5" />
            <span>{canUpgrade ? "Upgrade" : upgradeBlockedReason}</span>
          </button>
        </div>
      )}
    </div>
  );
};
