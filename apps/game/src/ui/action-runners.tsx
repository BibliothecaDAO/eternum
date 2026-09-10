import { resolveResourceArrivalIndicators } from "@/ui/utils/resource-arrival-indicators";
import { POLLING_INTERVALS } from "@/config/polling";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { gameCallArgs, gameEntityKey, getGameNamespace } from "@/sync/game-scope";
import { toast } from "@/ui/features/event-feed/notify";
import {
  createRealmProvisionRunner,
  type RealmProvisionCandidate,
  type RealmProvisionRetry,
} from "@/ui/realm-provision-runner";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { RESOURCE_ARRIVAL_AUTO_CLAIM_RETRY_DELAY_SECONDS, RESOURCE_ARRIVAL_READY_BUFFER_SECONDS } from "@/ui/constants";
import { VERBOSE_LOGS_ENABLED } from "@/utils/dev-mode";
import { extractTransactionHash, resolveTransactionFromGameStream } from "@/ui/utils/transactions";
import {
  clearUncertainClaimSharePointsSubmission,
  isNoHashSubmissionTimeout,
  rememberUncertainClaimSharePointsSubmission,
  shouldSkipAutomaticClaimSharePointsSubmission,
} from "@/ui/utils/uncertain-transaction-registry";
import {
  getBuildingCount,
  getIsBlitz,
  getStructureName,
  LeaderboardManager,
  ResourceArrivalManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { BuildingType, ContractAddress, StructureType, type ResourceArrivalInfo } from "@bibliothecadao/types";
import { getContractByName } from "@dojoengine/core";
import { getComponentValue } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { CallData } from "starknet";
import { dojoConfig } from "../../dojo-config";
import { env } from "../../env";

const getArrivalKey = (arrival: ResourceArrivalInfo) =>
  `${arrival.structureEntityId}-${arrival.day}-${arrival.slot.toString()}`;

/**
 * Claims the player's ready arrivals on the chain clock and keeps the arrived/pending counters current. Arrivals
 * come from the bridge's slice; this runner owns only the claim timer and its retry memory.
 */
const ResourceArrivalAutoClaim = () => {
  const setArrivalIndicators = useUIStore((state) => state.setArrivalIndicators);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const gameWinner = useUIStore((state) => state.gameWinner);
  const chainNowMs = useChainTimeStore((state) => state.nowMs);
  const getChainNowSeconds = useChainTimeStore((state) => state.getNowSeconds);
  const resourceArrivals = useWorldSlicesStore((state) => state.resourceArrivals);
  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();
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

  const isSeasonOver = useCallback(
    (nowSeconds?: number) => {
      if (gameWinner) return true;
      if (typeof gameEndAt !== "number") return false;
      const timestamp = typeof nowSeconds === "number" ? nowSeconds : getChainNowSeconds();
      return timestamp >= gameEndAt;
    },
    [gameEndAt, gameWinner, getChainNowSeconds],
  );

  const updateArrivalIndicators = useCallback(
    (arrivals: ResourceArrivalInfo[], nowOverride?: number) => {
      const now = nowOverride ?? getChainNowSeconds();
      const filteredArrivals = arrivals.filter((arrival) => !autoClaimedArrivals.current.has(getArrivalKey(arrival)));
      setArrivalIndicators(resolveResourceArrivalIndicators(filteredArrivals, now));
    },
    [getChainNowSeconds, setArrivalIndicators],
  );

  const scheduleNextAutoClaim = useCallback(() => {
    if (isSeasonOver()) {
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
  }, [isSeasonOver, stopAutoClaim]);

  useEffect(() => {
    updateArrivalIndicators(playerResourceArrivals, Math.floor(chainNowMs / 1000));
  }, [chainNowMs, playerResourceArrivals, updateArrivalIndicators]);

  useEffect(() => {
    processAutoClaimRef.current = async () => {
      const seasonNow = getChainNowSeconds();
      if (isSeasonOver(seasonNow)) {
        stopAutoClaim();
        return;
      }
      if (isAutoClaimingRef.current) {
        scheduleNextAutoClaim();
        return;
      }

      const arrivals = playerResourceArrivals;
      if (
        !account ||
        !account.address ||
        account.address === "0x0" ||
        playerStructures.length === 0 ||
        arrivals.length === 0
      ) {
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
            const resourceArrivalManager = new ResourceArrivalManager(components, systemCalls, arrival);
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
    components,
    getChainNowSeconds,
    isSeasonOver,
    playerResourceArrivals,
    playerStructures,
    scheduleNextAutoClaim,
    stopAutoClaim,
    systemCalls,
    updateArrivalIndicators,
  ]);

  return null;
};

const AUTO_REGISTER_POINTS_DEBUG = VERBOSE_LOGS_ENABLED;

/** Registers unregistered shareholder points on completed hyperstructures on a slow timer. */
const AutoRegisterPoints = () => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { claim_share_points },
    },
  } = useDojo();

  const isProcessingRef = useRef(false);
  const hyperstructures = useWorldSlicesStore((state) => state.hyperstructures);
  // Read through a ref so slice churn does not tear down and re-register the interval.
  const hyperstructuresRef = useRef(hyperstructures);
  hyperstructuresRef.current = hyperstructures;

  useEffect(() => {
    // No usable account (spectators, pre-login): no interval at all; the effect re-runs when an account connects.
    if (!account?.address || account.address === "0x0") {
      return;
    }

    const log = (...args: unknown[]) => {
      if (AUTO_REGISTER_POINTS_DEBUG) {
        console.log("[AutoRegisterPoints]", ...args);
      }
    };

    const checkAndRegisterPoints = async () => {
      log("Checking points...");
      if (isProcessingRef.current) {
        log("Skipped: already processing");
        return;
      }

      const leaderboardManager = LeaderboardManager.instance(components);
      const playerAddress = ContractAddress(account.address);
      const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(playerAddress);
      const unregisteredPoints = leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(playerAddress);
      log(`Registered: ${registeredPoints}, Unregistered: ${unregisteredPoints}`);
      if (unregisteredPoints <= 0) {
        log("Skipped: no unregistered points");
        return;
      }

      const hyperstructureIds = hyperstructuresRef.current
        .filter((hyperstructure) => hyperstructure.completed)
        .map((hyperstructure) => hyperstructure.hyperstructure_id);
      if (hyperstructureIds.length === 0) {
        log("Skipped: no completed hyperstructures");
        return;
      }

      log(`Registering points for ${hyperstructureIds.length} hyperstructures...`);
      isProcessingRef.current = true;
      let txHash: string | null = null;
      try {
        if (shouldSkipAutomaticClaimSharePointsSubmission(playerAddress)) {
          log("Skipped: unresolved no-hash claim submission");
          return;
        }
        const claimedPointsAtSubmit = leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(
          playerAddress,
          { ignorePendingClaimOverride: true },
        );

        const transactionResult = await claim_share_points({
          signer: account,
          hyperstructure_ids: hyperstructureIds,
        });
        txHash = extractTransactionHash(transactionResult);

        if (claimedPointsAtSubmit > 0) {
          leaderboardManager.setPendingSharePointsClaim(playerAddress, claimedPointsAtSubmit, txHash ?? undefined);
        }
        leaderboardManager.updatePoints();
        log("Points registration transaction submitted", txHash);

        if (txHash) {
          await resolveTransactionFromGameStream({ txHash, label: "auto-register points" });
        }

        leaderboardManager.confirmPendingSharePointsClaim(playerAddress, txHash ?? undefined);
        clearUncertainClaimSharePointsSubmission(playerAddress);
        leaderboardManager.forceRefresh();
        leaderboardManager.updatePoints();
        log("Points registered and leaderboard refreshed");
      } catch (error) {
        if (isNoHashSubmissionTimeout(error)) {
          rememberUncertainClaimSharePointsSubmission({
            walletAddress: playerAddress,
            failureKind: "submission_timeout_no_hash",
          });
        }
        leaderboardManager.clearPendingSharePointsClaim(playerAddress, txHash ?? undefined);
        leaderboardManager.updatePoints();
        console.error("[AutoRegisterPoints] Failed:", error);
      } finally {
        isProcessingRef.current = false;
      }
    };

    checkAndRegisterPoints();
    log(`Interval set: ${POLLING_INTERVALS.autoRegisterPointsMs}ms`);
    const intervalId = setInterval(checkAndRegisterPoints, POLLING_INTERVALS.autoRegisterPointsMs);
    return () => clearInterval(intervalId);
  }, [account, components, claim_share_points]);

  return null;
};

type ProvisionableRealm = RealmProvisionCandidate & { location: { x: number; y: number } };

/**
 * Provisions every owned realm once the main phase is open, at each confirmed head. The chain marks a provisioned
 * realm by its labor building, so the candidates read that count from RECS; there is no other flag.
 */
const AutoProvisionRealms = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();
  const isBlitzWorld = useResolvedWorldGameMode() === "blitz";

  useEffect(() => {
    if (!isBlitzWorld || !account?.address || account.address === "0x0") return;

    const readRealms = (): ProvisionableRealm[] =>
      useUIStore
        .getState()
        .playerStructures.filter((structure) => structure.category === StructureType.Realm)
        .flatMap((structure) => {
          const buildings = getComponentValue(
            components.StructureBuildings,
            gameEntityKey([BigInt(structure.entityId)]),
          );
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
        const { gameStartMainAt, gameEndAt, devModeOn } = useUIStore.getState();
        return { mainStartsAt: gameStartMainAt ?? null, endsAt: gameEndAt ?? null, devModeOn };
      },
      nowSeconds: () => useChainTimeStore.getState().getNowSeconds(),
      hasSigner: () => Boolean(useAccountStore.getState().account) && canIssueOrders(),
      submit: (realmIds) => submitRealmProvisions(account, realmIds),
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
  }, [account, components.StructureBuildings, isBlitzWorld]);

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

const submitRealmProvisions = async (
  account: NonNullable<ReturnType<typeof useDojo>["account"]["account"]>,
  realmIds: number[],
): Promise<void> => {
  const contract = getContractByName(dojoConfig.manifest, getGameNamespace(), "blitz_realm_systems");
  if (!contract?.address) throw new Error("blitz_realm_systems is missing from the active manifest");
  await executeObservedClientTransaction({
    account,
    calls: realmIds.map((realmId) => ({
      contractAddress: contract.address,
      entrypoint: "provision_realm",
      calldata: CallData.compile([...gameCallArgs(), realmId]),
    })),
    surface: "settlement",
    operation: "blitz_realm_systems.provision_realm",
    chain: env.VITE_PUBLIC_CHAIN,
    waitForConfirmation: true,
  });
};

/** The background actors that submit transactions on their own; every other former store manager is the bridge. */
export const ActionRunners = () => (
  <>
    <ResourceArrivalAutoClaim />
    <AutoRegisterPoints />
    <AutoProvisionRealms />
  </>
);
