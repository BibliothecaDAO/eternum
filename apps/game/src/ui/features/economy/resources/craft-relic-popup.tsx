import { knownAmount } from "@/ui/utils/utils";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import {
  HudButton,
  HudChip,
  HudMeter,
  HudNotice,
  HudPanel,
  HudRow,
  HudWindow,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { configManager, getEntityName, getIsBlitz } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { ID, ResourcesIds, StructureType, formatCharge, formatAmount } from "@bibliothecadao/types";
import { hash } from "starknet";
import { useEffect, useMemo, useState } from "react";
import { HeldRelic } from "@/ui/features/relics/components/relic-activation-shared";
import { accountAddress, useAccountAddress } from "@/hooks/store/use-account-store";

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
      const relicId = safeInteger(relicIdValue as string | number | bigint);
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
  /** Undefined while the research balance is unknown. */
  missingResearch: number | undefined;
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
      failureMessage:
        missingResearch === undefined
          ? "Research balance unknown."
          : `Need ${formatCharge(knownAmount(missingResearch))} more research.`,
    },
  ];
};

interface CraftRelicPopupProps {
  structureId: ID;
  onClose: () => void;
}

export const CraftRelicPopup = ({ structureId, onClose }: CraftRelicPopupProps) => {
  const {
    setup: { store, systemCalls },
    account: { account },
  } = useGame();
  const mode = useGameModeConfig();
  const revision = useNativeRevision(["Structure"]);

  const currentDefaultTick = useBlockTimestampStore((state) => state.currentDefaultTick);
  const nowSeconds = useNowSeconds();

  const [isCrafting, setIsCrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [craftedRelicId, setCraftedRelicId] = useState<ResourcesIds | null>(null);
  const [craftedWithoutReveal, setCraftedWithoutReveal] = useState(false);
  const resourceManager = useResourceManager(structureId);

  const viewer = useAccountAddress();
  const structureInfo = useMemo(
    () => mode.structure.getEntityInfo(structureId, viewer, store),
    [viewer, store, mode.structure, structureId, revision],
  );

  const structureCategory = structureInfo.structureCategory;
  const structureName = getEntityName(structureId, store, getIsBlitz()) ?? "Structure";

  const configuredResearchCost = configManager.getArtificerConfig().research_cost_for_relic;

  const researchBalance = useMemo(
    () => resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Research)?.balance,
    [currentDefaultTick, resourceManager],
  );

  const seasonConfig = configManager.getSeasonConfig();
  const seasonStarted = Number(seasonConfig.startMainAt) === 0 || nowSeconds >= Number(seasonConfig.startMainAt);
  const seasonNotEnded = Number(seasonConfig.endAt) === 0 || nowSeconds <= Number(seasonConfig.endAt);

  const canCraftStructureType =
    structureCategory === StructureType.Realm || structureCategory === StructureType.Village;
  const isOwnedByCaller = structureInfo.isMine;
  const hasEnoughResearch = researchBalance !== undefined && researchBalance >= configuredResearchCost;
  const missingResearch =
    researchBalance === undefined ? undefined : Math.max(configuredResearchCost - researchBalance, 0);
  const shouldShowResearchProgress = configuredResearchCost > 0;
  const researchProgress = shouldShowResearchProgress ? (researchBalance ?? 0) / configuredResearchCost : 0;

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
    ? `Burn ${formatCharge(knownAmount(configuredResearchCost))} research to mint one random relic.`
    : (preflightErrors[0] ?? "Cannot craft relic right now.");

  const craftButtonLabel = craftedRelicId || craftedWithoutReveal ? "Craft Again" : "Craft Relic";

  useEffect(() => {
    setCraftedRelicId(null);
    setCraftedWithoutReveal(false);
    setError(null);
  }, [structureId]);

  const handleCraftRelic = async () => {
    if (!account || accountAddress() === null) {
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
      const receipt = await systemCalls.burn_research_for_relic!({
        signer: account,
        structure_id: structureId,
      });

      const craftedRelic = extractCraftedRelicId(receipt, structureId);
      setCraftedRelicId(craftedRelic);
      setCraftedWithoutReveal(craftedRelic === null);
    } catch (craftError) {
      setError(mapCraftRelicError(craftError));
    } finally {
      setIsCrafting(false);
    }
  };

  const researchAfterCraft =
    researchBalance === undefined ? undefined : Math.max(researchBalance - configuredResearchCost, 0);

  return (
    <HudWindow title="Craft Relic" icon="forge" size="task" onClose={onClose}>
      <HudWindowFoot note={isCrafting ? "Submitting crafting transaction..." : actionHint}>
        <HudButton kind="quiet" onClick={onClose} disabled={isCrafting}>
          Close
        </HudButton>
        <HudButton
          kind="primary"
          busy={isCrafting ? "Forging relic…" : undefined}
          disabled={!canCraft}
          onClick={handleCraftRelic}
        >
          {craftButtonLabel}
        </HudButton>
      </HudWindowFoot>
      <div className="flex flex-col gap-3">
        <HudPanel kind="section" title="Relic Forge" icon="research" collapsible={false}>
          <div className="flex flex-col gap-2">
            <p>Burn research to craft one random relic.</p>
            {shouldShowResearchProgress && (
              <>
                <HudRow
                  title="Research ready"
                  trail={
                    <span className="tabular-nums">
                      {formatAmount(knownAmount(researchBalance))} / {formatCharge(knownAmount(configuredResearchCost))}
                    </span>
                  }
                />
                <HudMeter share={researchProgress} tone={hasEnoughResearch ? "good" : "warn"} label="Research ready" />
                {!hasEnoughResearch && (
                  <HudNotice
                    tone="bad"
                    line={
                      missingResearch === undefined
                        ? "Research balance unknown."
                        : `Need ${formatCharge(knownAmount(missingResearch))} more research.`
                    }
                  />
                )}
              </>
            )}
          </div>
        </HudPanel>

        <HudPanel kind="section" title={structureName} collapsible={false}>
          <HudRow title="Research Balance" trail={formatAmount(knownAmount(researchBalance))} />
          <HudRow title="Research Cost per Relic" trail={formatCharge(knownAmount(configuredResearchCost))} />
          <HudRow title="Balance After Craft" trail={formatAmount(knownAmount(researchAfterCraft))} />
        </HudPanel>

        <HudPanel kind="section" title="Crafting Requirements" collapsible={false}>
          {craftingRequirements.map((requirement) => (
            <HudRow
              key={requirement.id}
              title={requirement.label}
              trail={
                <HudChip tone={requirement.satisfied ? "good" : "bad"}>
                  {requirement.satisfied ? "READY" : "BLOCKED"}
                </HudChip>
              }
            />
          ))}
        </HudPanel>

        {craftedRelicId && (
          <HudPanel kind="section" title="Relic Crafted" collapsible={false}>
            <div className="flex flex-col items-start gap-2">
              <HeldRelic relicId={craftedRelicId} held="1" />
              <p className="text-hud-label text-hud-muted">
                Added to your relic inventory. Open the relic action to activate it.
              </p>
            </div>
          </HudPanel>
        )}

        {craftedWithoutReveal && !craftedRelicId && (
          <HudNotice
            tone="good"
            line="Relic crafted successfully."
            why="Reveal data is syncing and will appear in inventory shortly."
          />
        )}

        {error && <HudNotice tone="bad" line={error} />}
      </div>
    </HudWindow>
  );
};
