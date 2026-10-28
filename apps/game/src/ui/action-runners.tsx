import { requireActiveGameClient } from "@/sync/active-game-client";
import { startAutomationScope } from "@/ui/features/infrastructure/automation/model/automation-scope";
import {
  createAutomationTask,
  AutomationSignerUnavailable,
  AutomationPending,
} from "@/ui/features/infrastructure/automation/model/automation-runner";
import { resolveResourceArrivalIndicators } from "@/ui/utils/resource-arrival-indicators";

import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView, readFactView, resourceArrivalsView, seasonClockView } from "@/sync/fact-views";
import { actionFailure, toast } from "@/ui/features/event-feed/notify";
import {
  startRealmProvisionRunner,
  type RealmProvisionCandidate,
  type RealmProvisionRetry,
} from "@/ui/realm-provision-runner";
import { inFlight } from "@/hooks/store/use-actions-in-flight";
import { sendAutomaticProvision } from "@/ui/modules/entity-details/realm-castle-sends";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { RESOURCE_ARRIVAL_AUTO_CLAIM_RETRY_DELAY_SECONDS, RESOURCE_ARRIVAL_READY_BUFFER_SECONDS } from "@/ui/constants";

import { configManager, getBuildingCount, getStructureName, ResourceArrivalManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import {
  ActionRefusedError,
  BuildingType,
  StructureType,
  formatCount,
  type ResourceArrivalInfo,
} from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { accountAddress } from "@/hooks/store/use-account-store";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

const getArrivalKey = (arrival: ResourceArrivalInfo) =>
  `${arrival.structureEntityId}-${arrival.day}-${arrival.slot.toString()}`;

/**
 * Claims the player's ready arrivals on the chain clock and keeps the arrived/pending counters current. Arrivals
 * are read from the native store; this runner owns only the claim timer and its retry memory.
 */
const runArrivalClaims = createAutomationTask<ResourceArrivalInfo>();
const runRealmProvision = createAutomationTask<RealmProvisionCandidate>();

const ResourceArrivalAutoClaim = () => {
  const client = requireActiveGameClient();
  const setArrivalIndicators = useUIStore((state) => state.setArrivalIndicators);
  const playerStructures = useFactView(playerStructuresView);
  const chainNowMs = useNowMs();
  const getChainNowSeconds = useChainTimeStore((state) => state.getNowSeconds);
  const resourceArrivals = useFactView(resourceArrivalsView);
  const {
    account: { account },
    setup: { store, systemCalls },
  } = useGame();
  const autoClaimedArrivals = useRef<Set<string>>(new Set());
  const lastFailureRef = useRef<Map<string, number>>(new Map());
  const isAutoClaimingRef = useRef(false);
  const processAutoClaimRef = useRef<(signal: AbortSignal) => Promise<void | false>>(async () => {});
  const playerResourceArrivals = useMemo(() => {
    const playerStructureIds = new Set(playerStructures.map((structure) => structure.entityId));
    return resourceArrivals.filter((arrival) => playerStructureIds.has(arrival.structureEntityId));
  }, [playerStructures, resourceArrivals]);

  const updateArrivalIndicators = useCallback(
    (arrivals: ResourceArrivalInfo[], nowOverride?: number) => {
      const now = nowOverride ?? getChainNowSeconds();
      const filteredArrivals = arrivals.filter((arrival) => !autoClaimedArrivals.current.has(getArrivalKey(arrival)));
      setArrivalIndicators(resolveResourceArrivalIndicators(filteredArrivals, now));
    },
    [getChainNowSeconds, setArrivalIndicators],
  );

  useEffect(() => {
    updateArrivalIndicators(playerResourceArrivals, Math.floor(chainNowMs / 1000));
  }, [chainNowMs, playerResourceArrivals, updateArrivalIndicators]);

  useEffect(() => {
    processAutoClaimRef.current = async (signal) => {
      const seasonNow = getChainNowSeconds();
      if (configManager.isGameOver()) {
        return false;
      }
      if (isAutoClaimingRef.current) {
        return;
      }

      const arrivals = playerResourceArrivals;
      if (!account || accountAddress() === null) {
        autoClaimedArrivals.current.clear();
        lastFailureRef.current.clear();
        updateArrivalIndicators([]);
        return;
      }

      const activeArrivalKeys = new Set(arrivals.map((arrival) => getArrivalKey(arrival)));
      autoClaimedArrivals.current.forEach((key) => {
        if (!activeArrivalKeys.has(key)) autoClaimedArrivals.current.delete(key);
      });
      lastFailureRef.current.forEach((_, key) => {
        if (!activeArrivalKeys.has(key)) lastFailureRef.current.delete(key);
      });

      const retryDelaySeconds = RESOURCE_ARRIVAL_AUTO_CLAIM_RETRY_DELAY_SECONDS;
      const now = seasonNow;
      updateArrivalIndicators(arrivals, now);
      const readyArrivals = arrivals
        .filter((arrival) => arrival.resources.length > 0)
        .filter((arrival) => now >= Number(arrival.arrivesAt) + RESOURCE_ARRIVAL_READY_BUFFER_SECONDS);

      isAutoClaimingRef.current = true;

      try {
        await runArrivalClaims(
          {
            client,
            signer: account.address,
            signal,
            onConfirmed: (arrival) => {
              const arrivalKey = getArrivalKey(arrival);
              autoClaimedArrivals.current.add(arrivalKey);
              lastFailureRef.current.delete(arrivalKey);
            },
          },
          async (submit) => {
            const sortedReadyArrivals = readyArrivals.toSorted((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt));

            for (const arrival of sortedReadyArrivals) {
              if (signal.aborted) return;
              const arrivalKey = getArrivalKey(arrival);
              if (autoClaimedArrivals.current.has(arrivalKey)) continue;

              const lastFailure = lastFailureRef.current.get(arrivalKey);
              if (lastFailure && now - lastFailure < retryDelaySeconds) continue;

              try {
                await submit(arrival, (submitted) =>
                  new ResourceArrivalManager(systemCalls, submitted).offload(account, submitted.resources.length),
                );
              } catch (error) {
                if (signal.aborted) return;
                if (
                  error instanceof AutomationSignerUnavailable ||
                  error instanceof AutomationPending ||
                  error instanceof ActionRefusedError
                ) {
                  toast.warning(`Automatic arrival claims paused: ${error.message}`, { id: "arrival-claim-pending" });
                  return;
                }
                actionFailure(error, "Auto-claim arrival failed");
                lastFailureRef.current.set(arrivalKey, now);
              }
            }
          },
        );
      } catch (error) {
        if (!signal.aborted)
          toast.warning(error instanceof Error ? error.message : "Arrival claims are unavailable.", {
            id: "arrival-claim-pending",
          });
      } finally {
        isAutoClaimingRef.current = false;
        if (!signal.aborted) updateArrivalIndicators(arrivals, now);
      }
    };
  }, [
    client,
    account,
    store,
    getChainNowSeconds,
    playerResourceArrivals,
    playerStructures,
    systemCalls,
    updateArrivalIndicators,
  ]);

  useEffect(() => {
    autoClaimedArrivals.current.clear();
    lastFailureRef.current.clear();
    return startAutomationScope((signal) => processAutoClaimRef.current(signal));
  }, [client, account, store]);

  return null;
};

const AutoProvisionRealms = () => {
  const client = requireActiveGameClient();
  const {
    account: { account },
    setup: { store, systemCalls },
  } = useGame();
  const isBlitzWorld = useResolvedWorldGameMode() === "blitz";

  useEffect(() => {
    if (!isBlitzWorld || !account || accountAddress() === null) return;

    const readRealms = (): RealmProvisionCandidate[] =>
      readFactView(store, playerStructuresView)
        .filter((structure) => structure.category === StructureType.Realm)
        .flatMap((structure) => {
          const buildings = store.get("StructureBuildings", {
            game_id: configManager.getActiveGameId(),
            entity_id: structure.entityId,
          });
          if (!buildings) return [];
          const packedCounts = [buildings.packed_counts_1, buildings.packed_counts_2, buildings.packed_counts_3].map(
            (count) => BigInt(count),
          );
          return [
            {
              entityId: safeInteger(structure.entityId),
              name: getStructureName(structure.structure, store).name,
              provisioned: getBuildingCount(BuildingType.ResourceLabor, packedCounts) > 0,
            },
          ];
        });

    return startRealmProvisionRunner({
      readRealms,
      readPhase: () => {
        const { gameStartMainAt, devModeOn } = readFactView(store, seasonClockView);
        return { mainStartsAt: gameStartMainAt ?? null, over: configManager.isGameOver(), devModeOn };
      },
      nowSeconds: () => useChainTimeStore.getState().getNowSeconds(),
      hasSigner: () => Boolean(useAccountStore.getState().account) && canIssueOrders(),
      subscribeHeads: (head) =>
        useConnectionStore.subscribe((state, previous) => {
          if (state.lastConfirmedBlock !== previous.lastConfirmedBlock) head();
        }),
      isHeld: (realmId) => inFlight("castle", realmId) !== undefined,
      submit: (realm, onConfirmed, signal) =>
        runRealmProvision({ client, signer: account.address, signal, onConfirmed }, async (submit) =>
          submit(realm, (submitted) => sendAutomaticProvision(systemCalls, account, submitted.entityId)),
        ),
      report: {
        provisioned: (realms) => {
          toast.dismiss(provisionBatchNoticeId(realms));
        },
        failed: (realms, error, retry) =>
          realms.forEach((realm) =>
            toast.error(describeProvisionFailure([realm], error, retry), {
              id: provisionBatchNoticeId([realm]),
            }),
          ),
      },
    });
  }, [client, account, store, systemCalls, isBlitzWorld]);

  return null;
};

const provisionBatchNoticeId = (realms: RealmProvisionCandidate[]): string =>
  `provision:${realms.map((realm) => realm.entityId).join(",")}`;

const describeProvisionFailure = (
  realms: RealmProvisionCandidate[],
  error: unknown,
  retry: RealmProvisionRetry,
): string => {
  const names = realms.map((realm) => realm.name).join(", ");
  const reason = error instanceof Error ? error.message : "transaction rejected";
  if (error instanceof AutomationPending) return `Provisioning ${names}: ${reason} · automatic retries paused`;
  const next =
    retry.nextAttemptInHeads === null
      ? "giving up until reload"
      : `retry in ${formatCount(retry.nextAttemptInHeads, "block")}`;
  return `Provisioning ${names} failed (attempt ${retry.attempt}): ${reason} · ${next}`;
};

/** The background actors that submit transactions on their own; every other former store manager is the bridge. */
export const ActionRunners = () => (
  <>
    <ResourceArrivalAutoClaim />
    <AutoProvisionRealms />
  </>
);
