/**
 * Hook to handle world entry from the world selector.
 * Blitz worlds now enter through a single `settle` action.
 */
import { useAccountStore } from "@/hooks/store/use-account-store";
import { identityUsername, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { resolvePlayerNameFelt } from "@/services/identity/player-name";
import { submitSettlement } from "@/services/settlement";
import { resolveBlitzGrantStartingTroops } from "@/services/blitz/blitz-settlement-options";
import type { GameChain as Chain } from "@realms-world/chain";
import { useCallback, useMemo, useState } from "react";
import { Account } from "starknet";
import { isRegistrationCapacityReached, resolveEffectiveRegistrationCountMax } from "./registration-capacity";
import type { WorldConfigMeta } from "./use-world-availability";

interface SeasonRegistrationParams {
  realmId?: number;
  ownerAddress?: string;
  frontendAddress?: string;
  side?: number;
  layer?: number;
  point?: number;
}

export type EntryStage = "idle" | "preparing" | "settling" | "done" | "error";

interface UseWorldRegistrationProps {
  worldName: string;
  chain: Chain;
  config: WorldConfigMeta | null;
  isRegistered: boolean;
  enabled?: boolean;
}

interface UseWorldRegistrationReturn {
  /** Execute the world entry flow */
  settle: (params?: SeasonRegistrationParams) => Promise<void>;
  /** Current entry stage */
  entryStage: EntryStage;
  /** Whether world entry is in progress */
  isSettling: boolean;
  /** Error message if world entry failed */
  error: string | null;
  /** Whether world entry is currently possible */
  canSettle: boolean;
  /** Whether registration capacity has been reached */
  isRegistrationFull: boolean;
}

export const useWorldRegistration = ({
  worldName,
  chain,
  config,
  isRegistered,
  enabled = true,
}: UseWorldRegistrationProps): UseWorldRegistrationReturn => {
  const account = useAccountStore((state) => state.account);
  // The chain name written at registration is the identity username, when one was chosen.
  const accountName = useIdentitySessionStore((state) => identityUsername(state.session));
  const address = account?.address;
  const usernameFelt = useMemo(
    () => (address ? resolvePlayerNameFelt(address, accountName) : null),
    [accountName, address],
  );

  const [entryStage, setEntryStage] = useState<EntryStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const devModeOn = config?.devModeOn ?? false;
  const registrationCount = config?.registrationCount ?? 0;
  const registrationCountMax = resolveEffectiveRegistrationCountMax(config);
  const isRegistrationFull = isRegistrationCapacityReached(registrationCount, registrationCountMax);

  // Check if blitz settlement is open.
  const now = Date.now() / 1000;
  const registrationStartAt = config?.registrationStartAt ?? 0;
  const registrationEndAt = config?.registrationEndAt ?? 0;
  const isInRegistrationWindow =
    registrationStartAt > 0 &&
    registrationEndAt > registrationStartAt &&
    now >= registrationStartAt &&
    now < registrationEndAt;
  const isSettlementWindowOpen = isInRegistrationWindow || (devModeOn && now >= registrationStartAt);
  const canAttemptSettle = entryStage === "idle" || entryStage === "error";

  const canSettle =
    enabled &&
    !isRegistered &&
    isSettlementWindowOpen &&
    !!account &&
    !!address &&
    !!usernameFelt &&
    !isRegistrationFull &&
    // Appchain settle needs the chosen game's id as its first argument.
    (chain !== "appchain" || Boolean(config?.gameId)) &&
    canAttemptSettle;

  const isSettling = entryStage !== "idle" && entryStage !== "done" && entryStage !== "error";

  /**
   * Execute the world entry flow
   */
  const settle = useCallback(
    async (params?: SeasonRegistrationParams) => {
      if (!canSettle || !account) return;

      setError(null);
      setEntryStage("preparing");

      try {
        const starknetAccount = account as unknown as Account;

        // Eternum seasons settle exclusively through the entry modal's planner
        // path (placement + realm id are real choices there). A quick-settle
        // with placeholder placement would collide on the shared world.
        if (config?.mode === "eternum") {
          throw new Error("Eternum seasons settle through the entry modal.");
        }

        if (!config?.gameId || !usernameFelt) throw new Error("The selected game is not ready for settlement");
        setEntryStage("settling");
        await submitSettlement(config, starknetAccount, (client) =>
          client.setup.systemCalls.settle_blitz({
            signer: starknetAccount,
            name: usernameFelt,
            cosmeticsBlockHash: "0x0",
            cosmeticsBlockNumber: 0,
            cosmetics: [],
            grantStartingTroops: resolveBlitzGrantStartingTroops(),
          }),
        );

        setEntryStage("done");
      } catch (err) {
        console.error("Entry settlement failed:", err);
        setError(err instanceof Error ? err.message : "Settlement failed");
        setEntryStage("error");
      }
    },
    [canSettle, account, config, worldName, usernameFelt],
  );

  return {
    settle,
    entryStage,
    isSettling,
    error,
    canSettle,
    isRegistrationFull,
  };
};
