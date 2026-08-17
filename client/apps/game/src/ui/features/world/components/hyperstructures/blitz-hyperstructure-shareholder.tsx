import { env } from "@/../env";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo, useOwnedHyperstructuresEntityIds } from "@bibliothecadao/react";
import { ContractAddress, type ID } from "@bibliothecadao/types";
import React, { useEffect, useRef } from "react";

const ALLOCATE_SHARES_AFTER_CAPTURE_DELAY_MS = 5000;

export const BlitzSetHyperstructureShareholdersTo100 = React.memo(() => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { allocate_shares },
    },
  } = useDojo();
  const mode = useGameModeConfig();
  const isSpectating = useUIStore((state) => state.isSpectating);

  // listen to all the hyperstructures where you are owner with useEntityQuery
  const ownedHyperstructures = useOwnedHyperstructuresEntityIds();
  const previousOwnedHyperstructures = useRef<ID[]>([]);
  const allocateSharesDelayUntil = useRef<number>(0);
  const allocateSharesTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mode.rules.autoAllocateHyperstructureShares) return;
    // Spectators must never auto-fire transactions: the session either has no
    // real wallet (master/fallback account, ownership queries can match
    // against it) or is deliberately watching a game it owns structures in.
    if (isSpectating || isExplicitSpectateSession() || !account?.address) return;
    if (account.address === env.VITE_PUBLIC_MASTER_ADDRESS) return;

    const previousOwnedHyperstructuresSet = new Set(previousOwnedHyperstructures.current);
    const hasNewOwnedHyperstructure = ownedHyperstructures.some(
      (hyperstructureEntityId) => !previousOwnedHyperstructuresSet.has(hyperstructureEntityId),
    );
    previousOwnedHyperstructures.current = ownedHyperstructures;

    if (hasNewOwnedHyperstructure) {
      allocateSharesDelayUntil.current = Math.max(
        allocateSharesDelayUntil.current,
        Date.now() + ALLOCATE_SHARES_AFTER_CAPTURE_DELAY_MS,
      );
    }

    let cancelled = false;

    const allocateShares = async () => {
      // Skip if no hyperstructures or effect was cancelled
      if (cancelled || ownedHyperstructures.length === 0) return;

      const leaderboardManager = LeaderboardManager.instance(components);

      for (const hyperstructure of ownedHyperstructures) {
        // Skip if this hyperstructure was already processed or effect was cancelled
        if (cancelled) return;

        const currentCoOwners = leaderboardManager.getCurrentCoOwners(hyperstructure);

        if (
          currentCoOwners?.coOwners[0]?.percentage !== 10000 ||
          currentCoOwners?.coOwners[0]?.address !== ContractAddress(account.address)
        ) {
          try {
            await allocate_shares({
              signer: account,
              hyperstructure_entity_id: hyperstructure,
              co_owners: [[ContractAddress(account.address), 10000]],
            });
          } catch (error) {
            console.error("Failed to allocate shares for hyperstructure", hyperstructure, error);
          }
        }
      }
    };

    if (allocateSharesTimeoutId.current) {
      clearTimeout(allocateSharesTimeoutId.current);
    }

    const delayMs = Math.max(0, allocateSharesDelayUntil.current - Date.now());
    allocateSharesTimeoutId.current = setTimeout(() => {
      allocateShares();
    }, delayMs);

    return () => {
      cancelled = true;
      if (allocateSharesTimeoutId.current) {
        clearTimeout(allocateSharesTimeoutId.current);
        allocateSharesTimeoutId.current = null;
      }
    };
  }, [ownedHyperstructures, account, components, allocate_shares, mode, isSpectating]);

  return null;
});
