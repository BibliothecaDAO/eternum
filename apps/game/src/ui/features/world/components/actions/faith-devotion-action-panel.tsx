import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import {
  buildFaithLeaderboard,
  buildFaithfulStructureStatus,
  type FaithLeaderboardEntry,
} from "@/services/leaderboard/faith-leaderboard-service";
import { useFaithReadModels } from "@/services/leaderboard/use-faith-read-models";
import { WonderFaithDetailModal, WonderFaithDetailPanel } from "@/ui/features/social/faith/wonder-faith-detail-panel";
import Button from "@/ui/design-system/atoms/button";
import { HUD_BODY, HUD_BODY_MUTED, HUD_CUE, HUD_LABEL, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
import { REQUIREMENT_CHIP } from "@/ui/design-system/molecules/requirement-chips";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { displayAddress } from "@/ui/utils/utils";
import { useDojo } from "@bibliothecadao/react";
import { ID, StructureType } from "@bibliothecadao/types";
import Loader from "lucide-react/dist/esm/icons/loader";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/ui/features/event-feed/notify";

import { useStructureEntityDetail } from "../entities/hooks/use-structure-entity-detail";

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

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const formatFaithPerSecond = (value: number): string => {
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
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

  const wonderEntries = useMemo(() => buildFaithLeaderboard(faithReadModels), [faithReadModels]);
  const devotionStatus = useMemo(
    () => (eligibleForDevotion ? buildFaithfulStructureStatus(faithReadModels, structureEntityId) : null),
    [eligibleForDevotion, faithReadModels, structureEntityId],
  );
  const isLoadingWonders = false;
  const isLoadingDevotionStatus = false;

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

    return `Wonder #${devotionStatus.wonderId.toString()}`;
  }, [currentWonderEntry, devotionStatus]);

  const openDevotionModal = useCallback(() => {
    openSurface({
      id: "faith-devotion",
      content: (
        <FaithDevotionModal
          structureEntityId={structureEntityId}
          structureLabel={structureName ?? `Structure #${String(structureEntityId)}`}
        />
      ),
    });
  }, [structureEntityId, structureName, openSurface]);

  const openWonderDetailModal = useCallback(() => {
    openSurface({
      id: "wonder-faith",
      content: (
        <WonderFaithDetailModal
          wonderId={structureEntityId}
          fallbackWonderName={structureName ?? `Wonder #${String(structureEntityId)}`}
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
      <div className={cn("flex items-center gap-2", HUD_BODY_MUTED, className)}>
        <Loader className="h-3.5 w-3.5 animate-spin" />
        Loading structure
      </div>
    );
  }
  if (!structure) {
    return <p className={cn(HUD_BODY_MUTED, className)}>Structure data unavailable.</p>;
  }
  if (!eligibleForDevotion) {
    return <p className={cn(HUD_BODY_MUTED, className)}>Only realms and villages can devote themselves to a wonder.</p>;
  }
  if (isWonderStructure) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <WonderFaithDetailPanel
          wonderId={structureEntityId}
          fallbackWonderName={structureName ?? `Wonder #${String(structureEntityId)}`}
          compact
          className="min-h-0 flex-none"
        />
        <div>
          <button type="button" className={HUD_PILL_BUTTON} onClick={openWonderDetailModal}>
            Open wonder detail
          </button>
        </div>
      </div>
    );
  }
  const canDevote = isMine && !isLoadingWonders;
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
            <span className={HUD_LABEL}>Devoted to</span>
            <button
              type="button"
              className={cn(HUD_VALUE, "truncate underline-offset-2 hover:underline")}
              onClick={openCurrentWonderDetailModal}
              title="Open wonder detail"
            >
              {currentWonderLabel}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DevotionSplitStat
              label={`You · ${structureOwnerPercent}%`}
              value={`${formatFaithPerSecond(structureOwnerFpPerSec)} faith/s`}
            />
            <DevotionSplitStat
              label={`Wonder owner · ${wonderOwnerPercent}%`}
              value={`${formatFaithPerSecond(wonderOwnerFpPerSec)} faith/s`}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <span className={HUD_LABEL}>Not devoted</span>
          <p className={HUD_BODY}>
            Devote this structure to a wonder and both you and the wonder's owner earn faith every second.
          </p>
        </div>
      )}
      {isMine ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(HUD_PILL_BUTTON, !canDevote && "cursor-not-allowed opacity-60")}
            disabled={!canDevote}
            onClick={openDevotionModal}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {devotionStatus ? "Change devotion" : "Devote to a wonder"}
          </button>
        </div>
      ) : (
        <p className={HUD_BODY_MUTED}>Only the owner can change its devotion.</p>
      )}
    </div>
  );
};
const DevotionSplitStat = ({ label, value }: { label: string; value: string }) => (
  <div className={cn(REQUIREMENT_CHIP, "flex-col items-start gap-0.5")}>
    <span className={HUD_CUE}>{label}</span>
    <span className={HUD_VALUE}>{value}</span>
  </div>
);

const FaithDevotionModal = ({ structureEntityId, structureLabel }: FaithDevotionModalProps) => {
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const faithReadModels = useFaithReadModels();
  const {
    account: { account },
    setup: { systemCalls },
  } = useDojo();
  const faithSystemCalls = systemCalls as unknown as FaithSystemCallSet;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedWonderId, setSelectedWonderId] = useState<bigint | null>(null);

  const wonderEntries = useMemo(() => buildFaithLeaderboard(faithReadModels), [faithReadModels]);
  const devotionStatus = useMemo(
    () => buildFaithfulStructureStatus(faithReadModels, structureEntityId),
    [faithReadModels, structureEntityId],
  );
  const isLoadingWonders = false;
  const wondersError = null;

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

      toast.success("Devotion updated.");
      closeModal();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update devotion."));
    } finally {
      setIsSubmitting(false);
    }
  }, [account, closeModal, devotionStatus, faithSystemCalls, selectedWonderId, structureEntityId]);

  return (
    <SurfaceFrame
      title="Devote to a Wonder"
      onClose={closeModal}
      className="max-h-[calc(100vh-7rem)] w-[860px]"
      bodyClassName="overflow-auto"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="rounded-md border border-gold/20 bg-black/25 p-3 text-xxs text-gold/75">
          <p>
            Structure: <span className="font-semibold text-gold">{structureLabel}</span>
          </p>
          <p className="mt-1">
            Current devotion:{" "}
            <span className="font-semibold text-gold">
              {devotionStatus ? `Wonder #${devotionStatus.wonderId.toString()}` : "None"}
            </span>
          </p>
        </div>

        {isLoadingWonders ? (
          <div className="flex items-center justify-center py-8 text-xs text-gold/70">
            <Loader className="mr-2 h-4 w-4 animate-spin" />
            Loading wonders...
          </div>
        ) : wondersError ? (
          <div className="rounded-md border border-red-400/30 bg-red-950/25 p-3 text-xs text-red-200/90">
            {getErrorMessage(wondersError, "Failed to load wonders.")}
          </div>
        ) : wonderEntries.length === 0 ? (
          <div className="rounded-md border border-gold/20 bg-black/25 p-3 text-xs text-gold/75">
            No wonders available in this world yet.
          </div>
        ) : (
          <div className="max-h-[clamp(280px,40vh,560px)] overflow-auto rounded-md border border-gold/20 bg-black/25">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_110px_90px] gap-2 border-b border-gold/20 bg-[#1d160e] px-3 py-2 text-xxs uppercase tracking-[0.2em] text-gold/70">
              <span>Wonder</span>
              <span className="text-right">FP/sec</span>
              <span className="text-right">Followers</span>
            </div>
            <div className="flex flex-col">
              {wonderEntries.map((entry) => {
                const isSelected = selectedWonderId === entry.wonderId;

                return (
                  <button
                    key={entry.wonderId.toString()}
                    type="button"
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_110px_90px] gap-2 border-b border-gold/10 px-3 py-2 text-left transition",
                      isSelected ? "bg-gold/12" : "bg-transparent hover:bg-gold/6",
                    )}
                    onClick={() => setSelectedWonderId(entry.wonderId)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-gold">{entry.wonderName}</span>
                      <span className="block truncate text-xxs text-gold/65">{buildWonderOwnerLabel(entry)}</span>
                    </span>
                    <span className="text-right font-mono text-xs text-gold/85">
                      {entry.faithPointsPerSecond.toLocaleString()}
                    </span>
                    <span className="text-right font-mono text-xs text-gold/85">
                      {entry.followerCount.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-xxs text-gold/65">
            {selectedWonder ? (
              <span className="truncate">
                Selected: <span className="font-semibold text-gold">{selectedWonder.wonderName}</span>
              </span>
            ) : (
              "Select a wonder to continue."
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="xs" variant="outline" forceUppercase={false} onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="gold"
              forceUppercase={false}
              isLoading={isSubmitting}
              disabled={!selectedWonderId || alreadyDevotedToSelection}
              onClick={() => {
                void confirmDevotion();
              }}
            >
              {alreadyDevotedToSelection ? "Already Devoted" : "Confirm Devotion"}
            </Button>
          </div>
        </div>
      </div>
    </SurfaceFrame>
  );
};
