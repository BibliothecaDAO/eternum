import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { getFactorySqlBaseUrl } from "@/runtime/world";
import { resolveWorldContracts } from "@/runtime/world/factory-resolver";
import { normalizeSelector } from "@/runtime/world/normalize";
import { getWorldKey } from "@/hooks/use-world-availability";
import {
  resolveHyperstructureReservationBatchSize,
  resolveHyperstructureReservationCount,
} from "@/services/blitz/blitz-hyperstructure-reservation";
import { getGameManifest, type Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { getContractByName } from "@dojoengine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

const ETERNUM_NAMESPACE = "s1_eternum";

const resolveHyperstructureCreateSystemsAddress = async ({
  chain,
  worldName,
}: {
  chain: Chain;
  worldName: string;
}): Promise<string> => {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  if (!factorySqlBaseUrl) {
    throw new Error(`Factory SQL base URL not configured for chain: ${chain}`);
  }

  const manifest = getGameManifest(chain);
  const hyperstructureCreateSystems = getContractByName(
    manifest,
    ETERNUM_NAMESPACE,
    "hyperstructure_create_systems",
  ) as { selector?: string };
  const selector = hyperstructureCreateSystems.selector
    ? normalizeSelector(hyperstructureCreateSystems.selector)
    : null;

  if (!selector) {
    throw new Error("hyperstructure_create_systems selector not found in manifest");
  }

  const contracts = await resolveWorldContracts(factorySqlBaseUrl, worldName);
  const contractAddress = contracts[selector] ?? null;
  if (!contractAddress) {
    throw new Error("hyperstructure_create_systems contract not found for selected world");
  }

  return contractAddress;
};

export const useBlitzHyperstructureReservation = ({
  worldName,
  chain,
  remainingReservations,
  enabled = true,
}: {
  worldName: string;
  chain: Chain;
  remainingReservations: number | null;
  enabled?: boolean;
}) => {
  const { account } = useAccount();
  const queryClient = useQueryClient();
  const [isReserving, setIsReserving] = useState(false);

  const nextReservationCount = resolveHyperstructureReservationCount({
    remainingReservations,
    batchSize: resolveHyperstructureReservationBatchSize(),
  });

  const reserve = useCallback(async () => {
    if (!enabled) {
      throw new Error("Hyperstructure reservation is not available for this world right now.");
    }
    if (!account) {
      throw new Error("Connect a controller account before reserving hyperstructures.");
    }
    if (nextReservationCount <= 0) {
      return 0;
    }

    setIsReserving(true);

    try {
      const contractAddress = await resolveHyperstructureCreateSystemsAddress({
        chain,
        worldName,
      });

      await executeObservedClientTransaction({
        account,
        calls: {
          contractAddress,
          entrypoint: "reserve_hyperstructures",
          calldata: [nextReservationCount.toString()],
        },
        surface: "registration",
        operation: "hyperstructure_create_systems.reserve_hyperstructures",
        chain,
        worldName,
        waitForConfirmation: false,
      });

      const worldKey = getWorldKey({ name: worldName, chain });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["worldsSummary"] }),
        queryClient.invalidateQueries({ queryKey: ["worldAvailability", worldKey] }),
      ]);

      return nextReservationCount;
    } finally {
      setIsReserving(false);
    }
  }, [account, chain, enabled, nextReservationCount, queryClient, worldName]);

  return {
    reserve,
    isReserving,
    nextReservationCount,
  };
};
