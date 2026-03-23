import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  fetchFaithLeaderboard,
  fetchFaithfulStructureStatus,
  type FaithLeaderboardEntry,
} from "@/services/leaderboard/faith-leaderboard-service";
import { WonderFaithDetailModal, WonderFaithDetailPanel } from "@/ui/features/social/faith/wonder-faith-detail-panel";
import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import { displayAddress } from "@/ui/utils/utils";
import { useDojo } from "@bibliothecadao/react";
import { ID, StructureType } from "@bibliothecadao/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Loader from "lucide-react/dist/esm/icons/loader";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useStructureEntityDetail } from "../entities/hooks/use-structure-entity-detail";

const FAITH_REFRESH_INTERVAL_MS = 30_000;
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
  variant?: "compact" | "tab";
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

export const FaithDevotionActionPanel = ({
  structureEntityId,
  variant = "compact",
  className,
}: FaithDevotionActionPanelProps) => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const { structure, isMine, isLoadingStructure, structureName } = useStructureEntityDetail({ structureEntityId });

  const structureCategory = structure?.base?.category;
  const eligibleForDevotion = isDevotionEligible(structureCategory);
  const isWonderStructure = Boolean(structure?.metadata?.has_wonder);

  const { data: wonderEntries = [], isLoading: isLoadingWonders } = useQuery({
    queryKey: ["faith-devotion-wonders"],
    queryFn: () => fetchFaithLeaderboard(),
    staleTime: 10_000,
    refetchInterval: FAITH_REFRESH_INTERVAL_MS,
  });

  const { data: devotionStatus, isLoading: isLoadingDevotionStatus } = useQuery({
    queryKey: ["faith-devotion-status", String(structureEntityId)],
    queryFn: () => fetchFaithfulStructureStatus(structureEntityId),
    enabled: eligibleForDevotion,
    staleTime: 5_000,
    refetchInterval: eligibleForDevotion ? FAITH_REFRESH_INTERVAL_MS : false,
  });

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
    toggleModal(
      <FaithDevotionModal
        structureEntityId={structureEntityId}
        structureLabel={structureName ?? `Structure #${String(structureEntityId)}`}
      />,
    );
  }, [structureEntityId, structureName, toggleModal]);

  const openWonderDetailModal = useCallback(() => {
    toggleModal(
      <WonderFaithDetailModal
        wonderId={structureEntityId}
        fallbackWonderName={structureName ?? `Wonder #${String(structureEntityId)}`}
        onClose={() => toggleModal(null)}
      />,
    );
  }, [structureEntityId, structureName, toggleModal]);

  const currentWonderId = devotionStatus?.wonderId ?? null;
  const openCurrentWonderDetailModal = useCallback(() => {
    if (currentWonderId === null) {
      return;
    }

    toggleModal(
      <WonderFaithDetailModal
        wonderId={currentWonderId}
        fallbackWonderName={currentWonderLabel}
        onClose={() => toggleModal(null)}
      />,
    );
  }, [currentWonderId, currentWonderLabel, toggleModal]);

  if (isLoadingStructure) {
    return (
      <div className={cn("flex h-full items-center justify-center text-xxs text-gold/70", className)}>
        <Loader className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!structure) {
    return (
      <div className={cn("flex h-full items-center justify-center text-xxs text-gold/70 italic", className)}>
        Structure data unavailable.
      </div>
    );
  }

  if (!eligibleForDevotion) {
    return (
      <div className={cn("flex h-full flex-col justify-between gap-3", className)}>
        <div className="flex flex-col gap-1 text-left">
          <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Faith</span>
          <span className={cn("font-semibold text-gold", variant === "compact" ? "text-sm" : "text-base")}>
            Devotion
          </span>
          <p className="text-xxs text-gold/70">Only Realms and Villages can be devoted to a Wonder.</p>
        </div>
      </div>
    );
  }

  if (isWonderStructure) {
    const isCompactVariant = variant === "compact";

    return (
      <div className={cn("flex h-full min-h-0 flex-col", isCompactVariant ? "gap-2" : "gap-3", className)}>
        <div className="flex flex-col gap-1 text-left">
          <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Faith</span>
          <span className={cn("font-semibold text-gold", isCompactVariant ? "text-sm" : "text-base")}>
            Wonder Details
          </span>
        </div>

        <WonderFaithDetailPanel
          wonderId={structureEntityId}
          fallbackWonderName={structureName ?? `Wonder #${String(structureEntityId)}`}
          compact={isCompactVariant}
          className={cn("min-h-0", isCompactVariant ? "flex-none" : "flex-1")}
        />

        {isCompactVariant && (
          <Button
            size="xs"
            variant="outline"
            forceUppercase={false}
            className="w-full shrink-0 border-gold/40 bg-gold/10 text-gold hover:bg-gold/15"
            onClick={openWonderDetailModal}
          >
            Open Wonder Detail
          </Button>
        )}
      </div>
    );
  }

  const buttonLabel = devotionStatus ? "Change Devotion" : "Devote to Wonder";
  const canDevote = isMine && !isLoadingWonders;
  const structureOwnerFpPerSec = devotionStatus?.fpToStructureOwnerPerSec ?? 0;
  const wonderOwnerFpPerSec = devotionStatus?.fpToWonderOwnerPerSec ?? 0;
  const { structureOwnerPercent, wonderOwnerPercent } = resolveFaithSplitPercentages(
    structureOwnerFpPerSec,
    wonderOwnerFpPerSec,
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      <div className="flex flex-col gap-1 text-left">
        <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Faith</span>
        <span className={cn("font-semibold text-gold", variant === "compact" ? "text-sm" : "text-base")}>Devotion</span>
      </div>

      <div className="rounded-md border border-gold/25 bg-black/35 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xxs uppercase tracking-[0.25em] text-gold/60">Devotion</span>
          {isLoadingDevotionStatus && <Loader className="h-3.5 w-3.5 animate-spin text-gold/60" />}
        </div>
        <div
          className={cn(
            "mt-2 inline-flex max-w-full items-center rounded-md border px-2 py-1 text-xs font-semibold",
            devotionStatus ? "border-gold/35 bg-gold/10 text-gold" : "border-gold/20 bg-black/30 text-gold/75",
          )}
        >
          <span className="truncate">{devotionStatus ? `Devoted to ${currentWonderLabel}` : "Not devoted yet"}</span>
        </div>

        {devotionStatus ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <DevotionSplitStat label="You" value={`${formatFaithPerSecond(structureOwnerFpPerSec)} FP/s`} />
              <DevotionSplitStat label="Owner" value={`${formatFaithPerSecond(wonderOwnerFpPerSec)} FP/s`} />
            </div>

            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full border border-gold/25 bg-black/40">
                <div className="h-full bg-gold/75" style={{ width: `${structureOwnerPercent}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-gold/65">
                <span>You {structureOwnerPercent}%</span>
                <span>Owner {wonderOwnerPercent}%</span>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-xxs text-gold/65">
            Choose a Wonder to start generating Faith Points for both you and the Wonder owner.
          </p>
        )}
      </div>

      {devotionStatus ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="xs"
            variant="outline"
            forceUppercase={false}
            className="border-gold/40 bg-gold/10 text-gold hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canDevote}
            onClick={openDevotionModal}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isMine ? buttonLabel : "Only owner can devote"}</span>
          </Button>
          <Button
            size="xs"
            variant="outline"
            forceUppercase={false}
            className="border-gold/30 bg-black/30 text-gold/90 hover:bg-gold/10"
            onClick={openCurrentWonderDetailModal}
          >
            View Wonder
          </Button>
        </div>
      ) : (
        <Button
          size="xs"
          variant="outline"
          forceUppercase={false}
          className="w-full border-gold/40 bg-gold/10 text-gold hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canDevote}
          onClick={openDevotionModal}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{isMine ? buttonLabel : "Only owner can devote"}</span>
        </Button>
      )}
    </div>
  );
};

const DevotionSplitStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded border border-gold/20 bg-black/30 px-2 py-1.5">
    <div className="text-[10px] uppercase tracking-[0.16em] text-gold/60">{label}</div>
    <div className="mt-1 font-mono text-sm font-semibold text-gold">{value}</div>
  </div>
);

const FaithDevotionModal = ({ structureEntityId, structureLabel }: FaithDevotionModalProps) => {
  const queryClient = useQueryClient();
  const toggleModal = useUIStore((state) => state.toggleModal);
  const {
    account: { account },
    setup: { systemCalls },
  } = useDojo();
  const faithSystemCalls = systemCalls as unknown as FaithSystemCallSet;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedWonderId, setSelectedWonderId] = useState<bigint | null>(null);

  const {
    data: wonderEntries = [],
    isLoading: isLoadingWonders,
    error: wondersError,
  } = useQuery({
    queryKey: ["faith-devotion-wonders"],
    queryFn: () => fetchFaithLeaderboard(),
    staleTime: 10_000,
    refetchInterval: FAITH_REFRESH_INTERVAL_MS,
  });

  const { data: devotionStatus } = useQuery({
    queryKey: ["faith-devotion-status", String(structureEntityId)],
    queryFn: () => fetchFaithfulStructureStatus(structureEntityId),
    staleTime: 5_000,
  });

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
    toggleModal(null);
  }, [toggleModal]);

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

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["faith-devotion-wonders"] }),
        queryClient.invalidateQueries({ queryKey: ["faith-devotion-status", String(structureEntityId)] }),
      ]);

      toast.success("Devotion updated.");
      closeModal();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update devotion."));
    } finally {
      setIsSubmitting(false);
    }
  }, [account, closeModal, devotionStatus, faithSystemCalls, queryClient, selectedWonderId, structureEntityId]);

  return (
    <SecondaryPopup width="860" name="faith-devotion-modal" containerClassName="absolute left-0 top-0">
      <SecondaryPopup.Head onClose={closeModal}>Devote to a Wonder</SecondaryPopup.Head>
      <SecondaryPopup.Body width="100%" height="auto">
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
            <div className="max-h-[340px] overflow-auto rounded-md border border-gold/20 bg-black/25">
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
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
