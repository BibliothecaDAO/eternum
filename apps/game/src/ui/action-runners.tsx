import { resolveResourceArrivalIndicators } from "@/ui/utils/resource-arrival-indicators";

import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView, readFactView, resourceArrivalsView, seasonClockView } from "@/sync/fact-views";
import { toast } from "@/ui/features/event-feed/notify";
import {
  createRealmProvisionRunner,
  type RealmProvisionCandidate,
  type RealmProvisionRetry,
} from "@/ui/realm-provision-runner";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { RESOURCE_ARRIVAL_AUTO_CLAIM_RETRY_DELAY_SECONDS, RESOURCE_ARRIVAL_READY_BUFFER_SECONDS } from "@/ui/constants";

import {
  configManager,
  getBuildingCount,
  getIsBlitz,
  getStructureName,
  ResourceArrivalManager,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { BuildingType, StructureType, type ResourceArrivalInfo } from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { accountAddress } from "@/hooks/store/use-account-store";

const getArrivalKey = (arrival: ResourceArrivalInfo) =>
  `${arrival.structureEntityId}-${arrival.day}-${arrival.slot.toString()}`;

/**
 * Claims the player's ready arrivals on the chain clock and keeps the arrived/pending counters current. Arrivals
 * are read from the native store; this runner owns only the claim timer and its retry memory.
 */
const ResourceArrivalAutoClaim = () => {
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
  const autoClaimTimeoutIdRef = useRef<number | null>(null);
  const processAutoClaimRef = useRef<() => Promise<void>>(async () => {});
  const playerResourceArrivals = useMemo(() => {
    const playerStructureIds = new Set(playerStructures.map((structure) => structure.entityId));
    return resourceArrivals.filter((arrival) => playerStructureIds.has(arrival.structureEntityId));
  }, [playerStructures, resourceArrivals]);

  const stopAutoClaim = useCallback(() => {
    if (autoClaimTimeoutIdRef.current !== null) {
      window.clearTimeout(autoClaimTimeoutIdRef.current);
      autoClaimTimeoutIdRef.current = null;
    }
    isAutoClaimingRef.current = false;
  }, []);

  const updateArrivalIndicators = useCallback(
    (arrivals: ResourceArrivalInfo[], nowOverride?: number) => {
      const now = nowOverride ?? getChainNowSeconds();
      const filteredArrivals = arrivals.filter((arrival) => !autoClaimedArrivals.current.has(getArrivalKey(arrival)));
      setArrivalIndicators(resolveResourceArrivalIndicators(filteredArrivals, now));
    },
    [getChainNowSeconds, setArrivalIndicators],
  );

  const scheduleNextAutoClaim = useCallback(() => {
    if (configManager.isGameOver()) {
      stopAutoClaim();
      return;
    }
    if (autoClaimTimeoutIdRef.current !== null) {
      window.clearTimeout(autoClaimTimeoutIdRef.current);
    }

    const now = Date.now();
    const nextBlockMs = (Math.floor(now / 1000) + 1) * 1000;
    const delay = Math.max(250, nextBlockMs - now);

    autoClaimTimeoutIdRef.current = window.setTimeout(() => {
      void processAutoClaimRef.current();
    }, delay);
  }, [stopAutoClaim]);

  useEffect(() => {
    updateArrivalIndicators(playerResourceArrivals, Math.floor(chainNowMs / 1000));
  }, [chainNowMs, playerResourceArrivals, updateArrivalIndicators]);

  useEffect(() => {
    processAutoClaimRef.current = async () => {
      const seasonNow = getChainNowSeconds();
      if (configManager.isGameOver()) {
        stopAutoClaim();
        return;
      }
      if (isAutoClaimingRef.current) {
        scheduleNextAutoClaim();
        return;
      }

      const arrivals = playerResourceArrivals;
      if (!account || accountAddress() === null || playerStructures.length === 0 || arrivals.length === 0) {
        autoClaimedArrivals.current.clear();
        lastFailureRef.current.clear();
        updateArrivalIndicators([]);
        scheduleNextAutoClaim();
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

      if (readyArrivals.length === 0) {
        scheduleNextAutoClaim();
        return;
      }

      isAutoClaimingRef.current = true;

      try {
        const sortedReadyArrivals = readyArrivals.toSorted((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt));

        for (const arrival of sortedReadyArrivals) {
          const arrivalKey = getArrivalKey(arrival);
          if (autoClaimedArrivals.current.has(arrivalKey)) continue;

          const lastFailure = lastFailureRef.current.get(arrivalKey);
          if (lastFailure && now - lastFailure < retryDelaySeconds) continue;

          try {
            const resourceArrivalManager = new ResourceArrivalManager(systemCalls, arrival);
            await resourceArrivalManager.offload(account, arrival.resources.length);
            autoClaimedArrivals.current.add(arrivalKey);
            lastFailureRef.current.delete(arrivalKey);
          } catch (error) {
            console.error("Auto-claim arrival failed", { arrival, error });
            lastFailureRef.current.set(arrivalKey, now);
          }
        }
      } finally {
        isAutoClaimingRef.current = false;
        updateArrivalIndicators(arrivals, now);
        scheduleNextAutoClaim();
      }
    };

    scheduleNextAutoClaim();

    return () => {
      if (autoClaimTimeoutIdRef.current !== null) {
        window.clearTimeout(autoClaimTimeoutIdRef.current);
      }
      isAutoClaimingRef.current = false;
    };
  }, [
    account,
    store,
    getChainNowSeconds,
    playerResourceArrivals,
    playerStructures,
    scheduleNextAutoClaim,
    stopAutoClaim,
    systemCalls,
    updateArrivalIndicators,
  ]);

  return null;
};

type ProvisionableRealm = RealmProvisionCandidate & { location: { x: number; y: number } };

const AutoProvisionRealms = () => {
  const {
    account: { account },
    setup: { store, systemCalls },
  } = useGame();
  const isBlitzWorld = useResolvedWorldGameMode() === "blitz";

  useEffect(() => {
    if (!isBlitzWorld || !account || accountAddress() === null) return;

    const readRealms = (): ProvisionableRealm[] =>
      readFactView(store, playerStructuresView)
        .filter((structure) => structure.category === StructureType.Realm)
        .flatMap((structure) => {
          const buildings = store.get("StructureBuildings", {
            game_id: configManager.getActiveGameId(),
            entity_id: structure.entityId,
          });
          if (!buildings) return [];
          const packedCounts = [buildings.packed_counts_1, buildings.packed_counts_2, buildings.packed_counts_3].map(
            (count) => BigInt(count ?? 0),
          );
          return [
            {
              entityId: Number(structure.entityId),
              name: getStructureName(structure.structure, getIsBlitz()).name,
              provisioned: getBuildingCount(BuildingType.ResourceLabor, packedCounts) > 0,
              location: { x: structure.structure.base.coord_x, y: structure.structure.base.coord_y },
            },
          ];
        });

    const runner = createRealmProvisionRunner({
      readRealms,
      readPhase: () => {
        const { gameStartMainAt, devModeOn } = readFactView(store, seasonClockView);
        return { mainStartsAt: gameStartMainAt ?? null, over: configManager.isGameOver(), devModeOn };
      },
      nowSeconds: () => useChainTimeStore.getState().getNowSeconds(),
      hasSigner: () => Boolean(useAccountStore.getState().account) && canIssueOrders(),
      submit: async (realmIds) => {
        for (const realm_entity_id of realmIds) await systemCalls.provision_realm({ signer: account, realm_entity_id });
      },
      report: {
        provisioned: (realms) => {
          toast.dismiss(provisionBatchNoticeId(realms));
          realms.forEach((realm) =>
            toast.success(`Provisioned ${realm.name}`, { location: (realm as ProvisionableRealm).location }),
          );
        },
        // One row per batch: a repeat failure replaces it, a success dismisses it.
        failed: (realms, error, retry) =>
          toast.error(describeProvisionFailure(realms, error, retry), { id: provisionBatchNoticeId(realms) }),
      },
    });

    void runner.onConfirmedHead();
    return useConnectionStore.subscribe((state, previous) => {
      if (state.lastConfirmedBlock !== previous.lastConfirmedBlock) void runner.onConfirmedHead();
    });
  }, [account, store, systemCalls, isBlitzWorld]);

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
  const reason = extractReadableErrorMessage(error, "transaction rejected");
  const next =
    retry.nextAttemptInHeads === null
      ? "giving up until reload"
      : `retry in ${retry.nextAttemptInHeads} ${retry.nextAttemptInHeads === 1 ? "block" : "blocks"}`;
  return `Provisioning ${names} failed (attempt ${retry.attempt}): ${reason} · ${next}`;
};

/** The background actors that submit transactions on their own; every other former store manager is the bridge. */
export const ActionRunners = () => (
  <>
    <ResourceArrivalAutoClaim />
    <AutoProvisionRealms />
  </>
);
