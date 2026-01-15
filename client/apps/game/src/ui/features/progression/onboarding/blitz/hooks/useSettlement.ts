import { configManager, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo, usePlayerOwnedRealmEntities } from "@bibliothecadao/react";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { useCallback, useMemo, useState } from "react";
import { AccountInterface } from "starknet";
import { env } from "../../../../../../../env";
import { SettleStage } from "../types";

// Settlement configuration constants
const SETTLEMENT_CONFIG = {
  MAINNET: {
    MULTI_REALM: {
      INITIAL_SETTLE_COUNT: 1,
      EXTRA_CALLS: 2,
    },
    SINGLE_REALM: {
      INITIAL_SETTLE_COUNT: 1,
      EXTRA_CALLS: 0,
    },
  },
  NON_MAINNET: {
    MULTI_REALM: {
      INITIAL_SETTLE_COUNT: 3,
    },
    SINGLE_REALM: {
      INITIAL_SETTLE_COUNT: 1,
    },
  },
} as const;

export interface UseSettlementReturn {
  // Player state
  isRegistered: boolean;
  hasSettled: boolean;
  canPlay: boolean;

  // Settlement progress
  settleStage: SettleStage;
  assignedRealmCount: number;
  settledRealmCount: number;
  remainingToSettle: number;

  // Realm entities
  realmEntities: ReturnType<typeof usePlayerOwnedRealmEntities>;

  // Actions
  handleSettle: () => Promise<void>;
  isSettling: boolean;
}

export function useSettlement(account: AccountInterface | undefined): UseSettlementReturn {
  const {
    setup: {
      components,
      systemCalls: { blitz_realm_assign_and_settle_realms, blitz_realm_settle_realms },
    },
  } = useDojo();

  const accountAddress = account?.address;

  const [settleStage, setSettleStage] = useState<SettleStage>("idle");
  const [isSettling, setIsSettling] = useState(false);

  const playerRegistered = useComponentValue(
    components.BlitzRealmPlayerRegister,
    getEntityIdFromKeys([BigInt(accountAddress ?? "0")]),
  );

  const playerSettleFinish = useComponentValue(
    components.BlitzRealmSettleFinish,
    getEntityIdFromKeys([BigInt(accountAddress ?? "0")]),
  );

  const playerSettled =
    useEntityQuery([HasValue(components.Structure, { owner: BigInt(accountAddress ?? "0") })]).length > 0;

  const realmEntities = usePlayerOwnedRealmEntities();

  const assignedRealmCount = useMemo(() => {
    if (!playerSettleFinish) return 0;
    const coordsCount = (playerSettleFinish as any).coords?.length ?? 0;
    const settledCount = (playerSettleFinish as any).structure_ids?.length ?? 0;
    return coordsCount + settledCount;
  }, [playerSettleFinish]);

  const settledRealmCount = useMemo(() => {
    if (!playerSettleFinish) return 0;
    return (playerSettleFinish as any).structure_ids?.length ?? 0;
  }, [playerSettleFinish]);

  const remainingToSettle = Math.max(0, assignedRealmCount - settledRealmCount);
  const isRegistered = playerRegistered?.registered || playerSettled;
  const canPlay = playerSettled && assignedRealmCount > 0 && settledRealmCount === assignedRealmCount;

  const handleSettle = useCallback(async () => {
    if (!account) return;

    setIsSettling(true);
    try {
      const isCurrentlyRegistered = !!playerRegistered?.registered;
      const isMainnet = env.VITE_PUBLIC_CHAIN === "mainnet";

      // Get single_realm_mode from config
      const blitzConfig = configManager.getBlitzConfig();
      const singleRealmMode = blitzConfig?.blitz_settlement_config?.single_realm_mode ?? false;

      if (isCurrentlyRegistered) {
        setSettleStage("assigning");
        if (isMainnet) {
          const config = singleRealmMode
            ? SETTLEMENT_CONFIG.MAINNET.SINGLE_REALM
            : SETTLEMENT_CONFIG.MAINNET.MULTI_REALM;

          const initialSettleCount = config.INITIAL_SETTLE_COUNT;
          console.log(
            `[Blitz] Settling realms (mainnet, single_realm_mode=${singleRealmMode}): starting assign_and_settle_realms with settlement_count=${initialSettleCount}`,
          );
          await blitz_realm_assign_and_settle_realms({
            signer: account,
            settlement_count: initialSettleCount,
          });

          // Automatically settle remaining realms (only if not in single realm mode)
          const extraCalls = config.EXTRA_CALLS;
          if (extraCalls > 0) {
            setSettleStage("settling");
            for (let i = 0; i < extraCalls; i++) {
              console.log(`[Blitz] Settling realms (mainnet): extra settle_realms call ${i + 1}/${extraCalls}`);
              await blitz_realm_settle_realms({ signer: account, settlement_count: 1 });
            }
          }

          setSettleStage("done");
          return;
        } else {
          const config = singleRealmMode
            ? SETTLEMENT_CONFIG.NON_MAINNET.SINGLE_REALM
            : SETTLEMENT_CONFIG.NON_MAINNET.MULTI_REALM;

          const initialSettleCount = config.INITIAL_SETTLE_COUNT;
          console.log(
            `[Blitz] Settling realms (single_realm_mode=${singleRealmMode}): starting assign_and_settle_realms with settlement_count=${initialSettleCount}`,
          );
          await blitz_realm_assign_and_settle_realms({
            signer: account,
            settlement_count: initialSettleCount,
          });
          setSettleStage("done");
          return;
        }
      }

      const currentRemainingToSettle = Math.max(0, assignedRealmCount - settledRealmCount);

      if (currentRemainingToSettle <= 0) {
        console.log("[Blitz] Settling realms: nothing to settle");
        setSettleStage("done");
        return;
      }

      setSettleStage("settling");
      if (isMainnet) {
        const maxCalls = Math.min(currentRemainingToSettle, 3);
        for (let i = 0; i < maxCalls; i++) {
          console.log(`[Blitz] Settling realms (mainnet): settle_realms call ${i + 1}/${maxCalls}`);
          await blitz_realm_settle_realms({ signer: account, settlement_count: 1 });
        }
      } else {
        const settlementCountPerCall = Math.min(3, currentRemainingToSettle);
        console.log(`[Blitz] Settling realms: settle_realms with settlement_count=${settlementCountPerCall}`);
        await blitz_realm_settle_realms({ signer: account, settlement_count: settlementCountPerCall });
      }

      setSettleStage("done");
    } catch (error) {
      console.error("[Blitz] Settling realms failed", error);
      setSettleStage("error");
      throw error;
    } finally {
      setIsSettling(false);
    }
  }, [
    account,
    playerRegistered?.registered,
    assignedRealmCount,
    settledRealmCount,
    blitz_realm_assign_and_settle_realms,
    blitz_realm_settle_realms,
  ]);

  return {
    isRegistered,
    hasSettled: playerSettled,
    canPlay,
    settleStage,
    assignedRealmCount,
    settledRealmCount,
    remainingToSettle,
    realmEntities,
    handleSettle,
    isSettling,
  };
}
