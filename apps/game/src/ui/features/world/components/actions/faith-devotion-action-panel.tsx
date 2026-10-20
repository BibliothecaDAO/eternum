import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import {
  buildFaithfulStructureStatus,
  type FaithLeaderboardEntry,
} from "@/services/leaderboard/faith-leaderboard-service";
import { useFaithLeaderboard } from "@/services/leaderboard/use-faith-leaderboard";
import { useFaithReadModels } from "@/services/leaderboard/use-faith-read-models";
import { WonderFaithDetailModal, WonderFaithDetailPanel } from "@/ui/features/social/faith/wonder-faith-detail-panel";
import {
  HudButton,
  HudEmpty,
  HudTableHead,
  HudTableRow,
  HudWindow,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { displayAddress } from "@/ui/utils/utils";
import { useGame } from "@/hooks/context/game-context";
import { ID, StructureType, formatExact, formatPercent, formatRate, formatFigure } from "@bibliothecadao/types";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/ui/features/event-feed/notify";

import { useStructureEntityDetail } from "../entities/hooks/use-structure-entity-detail";
import { EntityDetailStat, EntityDetailStatList } from "../entities/layout";

const DEVOTION_ELIGIBLE_STRUCTURE_TYPES = new Set<StructureType>([StructureType.Realm, StructureType.Village]);

const isDevotionEligible = (category: unknown): boolean => {
  if (category === undefined || category === null) {
    return false;
  }

  return DEVOTION_ELIGIBLE_STRUCTURE_TYPES.has(Number(category) as StructureType);
};

const isZeroAddress = (address: string): boolean => {
  return /^0x0+$/i.test(address.trim());
};

const buildWonderOwnerLabel = (entry: FaithLeaderboardEntry): string => {
  const ownerName = entry.ownerName?.trim();
  if (ownerName) {
    return ownerName;
  }

  if (isZeroAddress(entry.ownerAddress)) {
    return "Unclaimed";
  }

  return displayAddress(entry.ownerAddress);
};

const resolveFaithSplitPercentages = (
  structureOwnerFpPerSec: number,
  wonderOwnerFpPerSec: number,
): { structureOwnerPercent: number; wonderOwnerPercent: number } => {
  const totalFpPerSec = structureOwnerFpPerSec + wonderOwnerFpPerSec;
  if (totalFpPerSec <= 0) {
    return { structureOwnerPercent: 70, wonderOwnerPercent: 30 };
  }

  const structureOwnerPercent = Math.round((structureOwnerFpPerSec / totalFpPerSec) * 100);
  return { structureOwnerPercent, wonderOwnerPercent: 100 - structureOwnerPercent };
};

interface FaithDevotionActionPanelProps {
  structureEntityId: ID;
  className?: string;
}

interface FaithDevotionModalProps {
  structureEntityId: ID;
  structureLabel: string;
}

interface FaithSystemCallSet {
  update_wonder_ownership: (props: { signer: unknown; wonder_id: number | bigint | string }) => Promise<unknown>;
  update_structure_ownership: (props: { signer: unknown; structure_id: number | bigint | string }) => Promise<unknown>;
  remove_faith: (props: { signer: unknown; structure_id: number | bigint | string }) => Promise<unknown>;
  pledge_faith: (props: {
    signer: unknown;
    structure_id: number | bigint | string;
    wonder_id: number | bigint | string;
  }) => Promise<unknown>;
}

/** Body of the structure panel's Faith section; the section supplies the title. */
export const FaithDevotionActionPanel = ({ structureEntityId, className }: FaithDevotionActionPanelProps) => {
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const resolvedWorldMode = useResolvedWorldGameMode();
  const isEternumMode = resolvedWorldMode === "eternum";
  const { structure, isMine, isLoadingStructure, structureName } = useStructureEntityDetail({ structureEntityId });
  const faithReadModels = useFaithReadModels();

  const structureCategory = structure?.base?.category;
  const eligibleForDevotion = isDevotionEligible(structureCategory);
  const isWonderStructure = Boolean(structure?.metadata?.has_wonder);

  const wonderEntries = useFaithLeaderboard();
  const devotionStatus = useMemo(
    () => (eligibleForDevotion ? buildFaithfulStructureStatus(faithReadModels, structureEntityId) : null),
    [eligibleForDevotion, faithReadModels, structureEntityId],
  );

  const wonderMap = useMemo(
    () => new Map(wonderEntries.map((entry) => [entry.wonderId.toString(), entry] as const)),
    [wonderEntries],
  );

  const currentWonderEntry = useMemo(() => {
    if (!devotionStatus) {
      return null;
    }

    return wonderMap.get(devotionStatus.wonderId.toString()) ?? null;
  }, [devotionStatus, wonderMap]);

  const currentWonderLabel = useMemo(() => {
    if (!devotionStatus) {
      return "None";
    }

    if (currentWonderEntry) {
      return currentWonderEntry.wonderName;
    }

    return "Wonder";
  }, [currentWonderEntry, devotionStatus]);

  const openDevotionModal = useCallback(() => {
    openSurface({
      id: "faith-devotion",
      content: (
        <FaithDevotionModal structureEntityId={structureEntityId} structureLabel={structureName ?? "Structure"} />
      ),
    });
  }, [structureEntityId, structureName, openSurface]);

  const openWonderDetailModal = useCallback(() => {
    openSurface({
      id: "wonder-faith",
      content: (
        <WonderFaithDetailModal
          wonderId={structureEntityId}
          fallbackWonderName={structureName ?? "Wonder"}
          onClose={closeSurface}
        />
      ),
    });
  }, [structureEntityId, structureName, openSurface]);

  const currentWonderId = devotionStatus?.wonderId ?? null;
  const openCurrentWonderDetailModal = useCallback(() => {
    if (currentWonderId === null) {
      return;
    }

    openSurface({
      id: "wonder-faith",
      content: (
        <WonderFaithDetailModal
          wonderId={currentWonderId}
          fallbackWonderName={currentWonderLabel}
          onClose={closeSurface}
        />
      ),
    });
  }, [currentWonderId, currentWonderLabel, openSurface]);

  if (!isEternumMode) {
    return null;
  }
  if (isLoadingStructure) {
    return (
      <div className={cn("flex items-center gap-2 text-hud-body text-hud-muted", className)}>
        <SemanticIcon name="refresh" className="h-3.5 w-3.5 animate-spin" />
        Loading structure
      </div>
    );
  }
  if (!structure) {
    return <p className={cn("text-hud-body text-hud-muted", className)}>Structure data unavailable.</p>;
  }
  if (!eligibleForDevotion) {
    return (
      <p className={cn("text-hud-body text-hud-muted", className)}>
        Only realms and villages can devote themselves to a wonder.
      </p>
    );
  }
  if (isWonderStructure) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <WonderFaithDetailPanel
          wonderId={structureEntityId}
          fallbackWonderName={structureName ?? "Wonder"}
          compact
          className="min-h-0 flex-none"
        />
        <div>
          <HudButton kind="secondary" size="sm" onClick={openWonderDetailModal}>
            Open wonder detail
          </HudButton>
        </div>
      </div>
    );
  }
  const structureOwnerFpPerSec = devotionStatus?.fpToStructureOwnerPerSec ?? 0;
  const wonderOwnerFpPerSec = devotionStatus?.fpToWonderOwnerPerSec ?? 0;
  const { structureOwnerPercent, wonderOwnerPercent } = resolveFaithSplitPercentages(
    structureOwnerFpPerSec,
    wonderOwnerFpPerSec,
  );
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {devotionStatus ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-hud-label text-hud-muted">Devoted to</span>
            <HudButton kind="quiet" size="sm" onClick={openCurrentWonderDetailModal} title="Open wonder detail">
              {currentWonderLabel}
            </HudButton>
          </div>
          <EntityDetailStatList compact columns={2}>
            <EntityDetailStat
              compact
              label={`You · ${formatPercent(structureOwnerPercent / 100)}`}
              value={`faith ${formatRate(structureOwnerFpPerSec)}`}
            />
            <EntityDetailStat
              compact
              label={`Wonder owner · ${formatPercent(wonderOwnerPercent / 100)}`}
              value={`faith ${formatRate(wonderOwnerFpPerSec)}`}
            />
          </EntityDetailStatList>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-hud-label text-hud-muted">Not devoted</span>
          <p className="text-hud-body text-hud-ink">
            Devote this structure to a wonder and both you and the wonder's owner earn faith every second.
          </p>
        </div>
      )}
      {isMine ? (
        <div className="flex flex-wrap gap-2">
          <HudButton kind="secondary" size="sm" icon="relics" onClick={openDevotionModal}>
            {devotionStatus ? "Change devotion" : "Devote to a wonder"}
          </HudButton>
        </div>
      ) : (
        <p className="text-hud-body text-hud-muted">Only the owner can change its devotion.</p>
      )}
    </div>
  );
};
const FaithDevotionModal = ({ structureEntityId, structureLabel }: FaithDevotionModalProps) => {
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const faithReadModels = useFaithReadModels();
  const {
    account: { account },
    setup: { systemCalls },
  } = useGame();
  const faithSystemCalls = systemCalls as unknown as FaithSystemCallSet;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedWonderId, setSelectedWonderId] = useState<bigint | null>(null);

  const wonderEntries = useFaithLeaderboard();
  const devotionStatus = useMemo(
    () => buildFaithfulStructureStatus(faithReadModels, structureEntityId),
    [faithReadModels, structureEntityId],
  );

  useEffect(() => {
    if (selectedWonderId !== null) {
      return;
    }

    const defaultWonderId = devotionStatus?.wonderId ?? wonderEntries[0]?.wonderId ?? null;
    setSelectedWonderId(defaultWonderId);
  }, [devotionStatus?.wonderId, selectedWonderId, wonderEntries]);

  const selectedWonder = useMemo(() => {
    if (!selectedWonderId) {
      return null;
    }

    return wonderEntries.find((entry) => entry.wonderId === selectedWonderId) ?? null;
  }, [selectedWonderId, wonderEntries]);

  const alreadyDevotedToSelection = useMemo(() => {
    if (!devotionStatus || !selectedWonderId) {
      return false;
    }

    return devotionStatus.wonderId === selectedWonderId;
  }, [devotionStatus, selectedWonderId]);

  const closeModal = useCallback(() => {
    closeSurface();
  }, [openSurface]);

  const confirmDevotion = useCallback(async () => {
    if (!selectedWonderId) {
      return;
    }

    if (!account) {
      toast.error("Connect a wallet before devoting.");
      return;
    }

    setIsSubmitting(true);

    try {
      await faithSystemCalls.update_wonder_ownership({
        signer: account,
        wonder_id: selectedWonderId,
      });

      await faithSystemCalls.update_structure_ownership({
        signer: account,
        structure_id: structureEntityId,
      });

      if (devotionStatus) {
        await faithSystemCalls.remove_faith({
          signer: account,
          structure_id: structureEntityId,
        });
      }

      await faithSystemCalls.pledge_faith({
        signer: account,
        structure_id: structureEntityId,
        wonder_id: selectedWonderId,
      });

      closeModal();
    } catch (error) {
      toast.failed(error, "Failed to update devotion.");
    } finally {
      setIsSubmitting(false);
    }
  }, [account, closeModal, devotionStatus, faithSystemCalls, selectedWonderId, structureEntityId]);

  const currentWonderName = devotionStatus
    ? (wonderEntries.find((entry) => entry.wonderId === devotionStatus.wonderId)?.wonderName ?? "Wonder")
    : "None";

  return (
    <HudWindow title="Devote to a Wonder" icon="relics" size="page" onClose={closeModal}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-hud-body text-hud-muted">
          <p>
            Structure: <span className="text-hud-strong text-hud-ink">{structureLabel}</span>
          </p>
          <p>
            Current devotion: <span className="text-hud-strong text-hud-ink">{currentWonderName}</span>
          </p>
        </div>
        {wonderEntries.length === 0 ? (
          <HudEmpty icon="relics" line="No wonders available in this world yet." />
        ) : (
          <WonderTable entries={wonderEntries} selectedId={selectedWonderId} onSelect={setSelectedWonderId} />
        )}
      </div>
      <HudWindowFoot note={selectedWonder ? `Selected: ${selectedWonder.wonderName}` : "Select a wonder to continue."}>
        <HudButton kind="quiet" onClick={closeModal} disabled={isSubmitting}>
          Cancel
        </HudButton>
        <HudButton
          kind="primary"
          busy={isSubmitting ? "Devoting…" : undefined}
          disabled={!selectedWonderId || alreadyDevotedToSelection}
          onClick={() => {
            void confirmDevotion();
          }}
        >
          {alreadyDevotedToSelection ? "Already Devoted" : "Confirm Devotion"}
        </HudButton>
      </HudWindowFoot>
    </HudWindow>
  );
};

const WONDER_COLUMNS = "minmax(0,1fr) 110px 90px";

/** The wonders a structure can devote to, the chosen one lit: name and owner, faith a second, followers. */
const WonderTable = ({
  entries,
  selectedId,
  onSelect,
}: {
  entries: FaithLeaderboardEntry[];
  selectedId: bigint | null;
  onSelect: (wonderId: bigint) => void;
}) => (
  <div>
    <HudTableHead cols={WONDER_COLUMNS}>
      <span>Wonder</span>
      <span className="text-right">FP/sec</span>
      <span className="text-right">Followers</span>
    </HudTableHead>
    {entries.map((entry) => (
      <HudTableRow
        key={entry.wonderId.toString()}
        cols={WONDER_COLUMNS}
        label={entry.wonderName}
        selected={selectedId === entry.wonderId}
        onClick={() => onSelect(entry.wonderId)}
      >
        <span className="min-w-0 text-left">
          <span className="block truncate text-hud-body text-hud-ink">{entry.wonderName}</span>
          <span className="block truncate text-hud-label text-hud-muted">{buildWonderOwnerLabel(entry)}</span>
        </span>
        <span className="text-right text-hud-body text-hud-ink">{formatFigure(entry.faithPointsPerSecond)}</span>
        <span className="text-right text-hud-body text-hud-ink">{formatExact(entry.followerCount)}</span>
      </HudTableRow>
    ))}
  </div>
);
