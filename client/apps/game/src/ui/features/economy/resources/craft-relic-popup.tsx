import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { BasePopup } from "@/ui/design-system/molecules/base-popup";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { configManager } from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { ContractAddress, findResourceById, ID, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { hash } from "starknet";
import { useEffect, useMemo, useState } from "react";

import Button from "@/ui/design-system/atoms/button";

const BURN_RESEARCH_FOR_RELIC_EVENT_SELECTOR = hash.getSelectorFromName("BurnResearchForRelicEvent").toLowerCase();

type ReceiptEventLike = {
  keys?: unknown[];
  data?: unknown[];
};

const normalizeFelt = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return `0x${BigInt(value as string | number | bigint).toString(16)}`.toLowerCase();
  } catch {
    return null;
  }
};

const extractReceiptEvents = (receipt: unknown): ReceiptEventLike[] => {
  if (!receipt || typeof receipt !== "object") {
    return [];
  }

  const directEvents = (receipt as { events?: unknown }).events;
  if (Array.isArray(directEvents)) {
    return directEvents as ReceiptEventLike[];
  }

  const wrappedEvents = (receipt as { value?: { events?: unknown } }).value?.events;
  if (Array.isArray(wrappedEvents)) {
    return wrappedEvents as ReceiptEventLike[];
  }

  return [];
};

const extractCraftedRelicId = (receipt: unknown, structureId: ID): ResourcesIds | null => {
  const structureKey = normalizeFelt(structureId);
  const events = extractReceiptEvents(receipt);

  for (const event of events) {
    const keySelector = normalizeFelt(event.keys?.[0]);
    if (!keySelector || keySelector !== BURN_RESEARCH_FOR_RELIC_EVENT_SELECTOR) {
      continue;
    }

    const eventStructureKey = normalizeFelt(event.keys?.[1]);
    if (structureKey && eventStructureKey && eventStructureKey !== structureKey) {
      continue;
    }

    const relicIdValue = event.data?.[0];
    if (relicIdValue === undefined || relicIdValue === null) {
      continue;
    }

    try {
      const relicId = Number(BigInt(relicIdValue as string | number | bigint));
      if (Number.isInteger(relicId) && relicId > 0) {
        return relicId as ResourcesIds;
      }
    } catch {
      // Ignore malformed event rows and continue scanning.
    }
  }

  return null;
};

const mapCraftRelicError = (error: unknown): string => {
  const readable = extractReadableErrorMessage(error, "Failed to craft relic.");
  const normalized = readable.toLowerCase();

  if (normalized.includes("structure is not a realm or village")) {
    return "Only realms and villages can craft relics.";
  }

  if (normalized.includes("not owner")) {
    return "You must own this structure to craft relics.";
  }

  if (normalized.includes("season is over")) {
    return "Season is already over.";
  }

  if (normalized.includes("the game starts in") || normalized.includes("settle your realm or village")) {
    return "Season has not started yet.";
  }

  if (normalized.includes("insufficient balance")) {
    return "Not enough research to craft a relic.";
  }

  return readable;
};

interface CraftingRequirement {
  id: string;
  label: string;
  satisfied: boolean;
  failureMessage: string;
}

interface CraftingRequirementInput {
  canCraftStructureType: boolean;
  isOwnedByCaller: boolean;
  seasonStarted: boolean;
  seasonNotEnded: boolean;
  hasEnoughResearch: boolean;
  missingResearch: number;
}

const resolveCraftingRequirements = ({
  canCraftStructureType,
  isOwnedByCaller,
  seasonStarted,
  seasonNotEnded,
  hasEnoughResearch,
  missingResearch,
}: CraftingRequirementInput): CraftingRequirement[] => {
  return [
    {
      id: "structure-type",
      label: "Structure is Realm or Village",
      satisfied: canCraftStructureType,
      failureMessage: "Only realms and villages can craft relics.",
    },
    {
      id: "ownership",
      label: "You own this structure",
      satisfied: isOwnedByCaller,
      failureMessage: "You must own this structure to craft relics.",
    },
    {
      id: "season-started",
      label: "Season has started",
      satisfied: seasonStarted,
      failureMessage: "Season has not started yet.",
    },
    {
      id: "season-open",
      label: "Season has not ended",
      satisfied: seasonNotEnded,
      failureMessage: "Season is already over.",
    },
    {
      id: "research-balance",
      label: "Enough research balance",
      satisfied: hasEnoughResearch,
      failureMessage: `Need ${currencyFormat(missingResearch, 0)} more research.`,
    },
  ];
};

interface CraftRelicPopupProps {
  structureId: ID;
  onClose: () => void;
}

export const CraftRelicPopup = ({ structureId, onClose }: CraftRelicPopupProps) => {
  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();
  const mode = useGameModeConfig();

  const triggerRelicsRefresh = useUIStore((state) => state.triggerRelicsRefresh);
  const currentDefaultTick = useBlockTimestampStore((state) => state.currentDefaultTick);
  const nowSeconds = useChainTimeStore((state) => Math.floor(state.nowMs / 1000));

  const [isCrafting, setIsCrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [craftedRelicId, setCraftedRelicId] = useState<ResourcesIds | null>(null);
  const [craftedWithoutReveal, setCraftedWithoutReveal] = useState(false);
  const [optimisticResearchBalance, setOptimisticResearchBalance] = useState<number | null>(null);

  const resourceManager = useResourceManager(structureId);

  const structureInfo = useMemo(() => {
    const playerAccount = ContractAddress(account?.address ?? "0x0");
    return mode.structure.getEntityInfo(structureId, playerAccount, components);
  }, [account?.address, components, mode.structure, structureId]);

  const structureCategory = Number(structureInfo.structureCategory ?? 0);
  const structureName = structureInfo.name?.name ?? `Structure #${structureId}`;

  const configuredResearchCost = Number(configManager.getArtificerConfig().research_cost_for_relic ?? 0);

  const currentResearchBalance = useMemo(() => {
    if (!currentDefaultTick) {
      return Number(resourceManager.balance(ResourcesIds.Research));
    }

    const data = resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Research);
    return data.balance;
  }, [currentDefaultTick, resourceManager]);

  const displayedResearchBalance = optimisticResearchBalance ?? currentResearchBalance;

  const seasonConfig = configManager.getSeasonConfig();
  const seasonStarted = Number(seasonConfig.startMainAt) === 0 || nowSeconds >= Number(seasonConfig.startMainAt);
  const seasonNotEnded = Number(seasonConfig.endAt) === 0 || nowSeconds <= Number(seasonConfig.endAt);

  const canCraftStructureType =
    structureCategory === StructureType.Realm || structureCategory === StructureType.Village;
  const isOwnedByCaller = Boolean(account?.address && structureInfo.isMine);
  const hasEnoughResearch = displayedResearchBalance >= configuredResearchCost;
  const missingResearch = Math.max(configuredResearchCost - displayedResearchBalance, 0);
  const shouldShowResearchProgress = configuredResearchCost > 0;
  const researchProgressPercent = shouldShowResearchProgress
    ? Math.min((displayedResearchBalance / configuredResearchCost) * 100, 100)
    : 0;

  const craftingRequirements = useMemo(() => {
    return resolveCraftingRequirements({
      canCraftStructureType,
      isOwnedByCaller,
      seasonStarted,
      seasonNotEnded,
      hasEnoughResearch,
      missingResearch,
    });
  }, [canCraftStructureType, isOwnedByCaller, seasonStarted, seasonNotEnded, hasEnoughResearch, missingResearch]);

  const preflightErrors = useMemo(() => {
    return craftingRequirements
      .filter((requirement) => !requirement.satisfied)
      .map((requirement) => requirement.failureMessage);
  }, [craftingRequirements]);

  const canCraft = preflightErrors.length === 0;
  const actionHint = canCraft
    ? `Burn ${currencyFormat(configuredResearchCost, 0)} research to mint one random relic.`
    : (preflightErrors[0] ?? "Cannot craft relic right now.");
  const researchResourceKey = ResourcesIds[ResourcesIds.Research];
  const craftButtonLabel = craftedRelicId || craftedWithoutReveal ? "Craft Again" : "Craft Relic";

  useEffect(() => {
    setCraftedRelicId(null);
    setCraftedWithoutReveal(false);
    setError(null);
    setOptimisticResearchBalance(null);
  }, [structureId]);

  const handleCraftRelic = async () => {
    if (!account || account.address === "0x0") {
      setError("Account not connected.");
      return;
    }

    if (!systemCalls.burn_research_for_relic) {
      setError("Relic crafting is not available yet.");
      return;
    }

    if (!canCraft) {
      setError(preflightErrors[0] ?? "Cannot craft relic right now.");
      return;
    }

    setIsCrafting(true);
    setError(null);

    try {
      const receipt = await systemCalls.burn_research_for_relic({
        signer: account,
        structure_id: structureId,
      });

      const craftedRelic = extractCraftedRelicId(receipt, structureId);
      setCraftedRelicId(craftedRelic);
      setCraftedWithoutReveal(craftedRelic === null);

      setOptimisticResearchBalance(Math.max(displayedResearchBalance - configuredResearchCost, 0));
      triggerRelicsRefresh();
    } catch (craftError) {
      setError(mapCraftRelicError(craftError));
    } finally {
      setIsCrafting(false);
    }
  };

  const craftedRelicName = craftedRelicId
    ? (findResourceById(craftedRelicId)?.trait ?? ResourcesIds[craftedRelicId])
    : null;
  const craftedRelicResourceKey = craftedRelicId ? ResourcesIds[craftedRelicId] : null;

  const footer = (
    <>
      <div className="flex justify-center space-x-4">
        <Button variant="default" onClick={onClose} disabled={isCrafting}>
          Close
        </Button>
        <Button
          variant="gold"
          onClick={handleCraftRelic}
          isLoading={isCrafting}
          disabled={isCrafting || !canCraft}
          forceUppercase={false}
        >
          {craftButtonLabel}
        </Button>
      </div>
      <div className="mt-3 px-3 text-center text-[11px] text-gold/70">
        {isCrafting ? "Submitting crafting transaction..." : actionHint}
      </div>
      {error && (
        <div role="alert" className="px-3 mt-3 text-danger font-bold text-center">
          {error}
        </div>
      )}
    </>
  );

  return (
    <BasePopup title="Craft Relic" onClose={onClose} footer={footer} contentClassName="max-w-[520px]">
      <div className="space-y-4 text-left">
        <div className="rounded border border-relic/40 bg-gradient-to-b from-relic/20 to-dark-brown/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-relic2/90">Relic Forge</p>
              <p className="mt-2 text-sm text-gold/90">Burn research to craft one random relic.</p>
            </div>
            <ResourceIcon resource={researchResourceKey} size="md" withTooltip={false} />
          </div>

          {shouldShowResearchProgress && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-gold/70">
                <span>Research ready</span>
                <span>
                  {currencyFormat(displayedResearchBalance, 0)} / {currencyFormat(configuredResearchCost, 0)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-brown/60">
                <div
                  className={hasEnoughResearch ? "h-full bg-green transition-all" : "h-full bg-gold transition-all"}
                  style={{ width: `${researchProgressPercent}%` }}
                />
              </div>
              {!hasEnoughResearch && (
                <p className="mt-1 text-[11px] text-danger">Need {currencyFormat(missingResearch, 0)} more research.</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded border border-gold/20 bg-dark-brown/30 p-4">
          <p className="text-sm font-semibold text-gold">{structureName}</p>
          <p className="text-xs text-gold/70">Structure #{structureId}</p>

          <div className="mt-3 space-y-2 text-xs text-gold/80">
            <div className="flex items-center justify-between">
              <span>Research Balance</span>
              <span className="font-semibold text-gold">{currencyFormat(displayedResearchBalance, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Research Cost per Relic</span>
              <span className="font-semibold text-gold">{currencyFormat(configuredResearchCost, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Balance After Craft</span>
              <span className="font-semibold text-gold">
                {currencyFormat(Math.max(displayedResearchBalance - configuredResearchCost, 0), 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded border border-gold/20 bg-dark-brown/30 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-gold/70">Crafting Requirements</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {craftingRequirements.map((requirement) => (
              <li key={requirement.id} className="flex items-center justify-between gap-3">
                <span className={requirement.satisfied ? "text-gold/85" : "text-danger"}>{requirement.label}</span>
                <span
                  className={
                    requirement.satisfied
                      ? "rounded bg-green/20 px-1.5 py-0.5 text-[10px] font-semibold text-green"
                      : "rounded bg-danger/20 px-1.5 py-0.5 text-[10px] font-semibold text-danger"
                  }
                >
                  {requirement.satisfied ? "READY" : "BLOCKED"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {isCrafting && (
          <div className="rounded border border-gold/20 bg-gold/10 p-3 text-center text-xs text-gold/80">
            Forging relic on-chain...
          </div>
        )}

        {craftedRelicId && craftedRelicResourceKey && (
          <div className="rounded border border-relic/50 bg-relic/15 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-relic2">Relic Crafted</p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <ResourceIcon resource={craftedRelicResourceKey} size="lg" />
              <p className="text-sm font-semibold text-relic2">{craftedRelicName ?? "Unknown Relic"}</p>
            </div>
            <p className="mt-2 text-[11px] text-relic2/90">
              Added to your relic inventory. Open the relic action to activate it.
            </p>
          </div>
        )}

        {craftedWithoutReveal && !craftedRelicId && (
          <div className="rounded border border-relic/50 bg-relic/15 p-4 text-center text-sm text-relic2">
            Relic crafted successfully. Reveal data is syncing and will appear in inventory shortly.
          </div>
        )}
      </div>
    </BasePopup>
  );
};
