import type { RealmMetadataStatus } from "@/lib/realms/inventory-metadata";
import type { RealmOwnershipInventoryStatus } from "@realms-world/db";
import { RealmMetadataABI } from "@/abi/L2/RealmMetadata";
import { hydrateRealmMetadata } from "@/lib/realms/inventory-metadata";
import { readRealmMetadata } from "@/lib/realms/metadata";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { env } from "env";
import { Contract, RpcProvider } from "starknet";
import { z } from "zod";

import { CollectionAddresses } from "@realms-world/constants";
import {
  getRealmOwnershipInventory,
  normalizeRealmOwnerAddress,
  starknetRealmMetadata,
} from "@realms-world/db";
import { db } from "@realms-world/db/client";

export interface RealmInventoryToken {
  token_id: number;
  metadata?: string;
  metadata_status: RealmMetadataStatus;
}

export interface RealmInventoryResponse {
  status: RealmOwnershipInventoryStatus;
  tokens: RealmInventoryToken[];
  checkpoint: {
    blockNumber: string;
    blockTimestamp: string;
  } | null;
}

const GetRealmInventoryInput = z.object({
  address: z.string().optional(),
});

/**
 * Visible wallet screens poll four times per minute so recent transfers appear
 * promptly without polling while the tab is in the background.
 */
export const REALM_INVENTORY_REFETCH_INTERVAL_MS = 15_000;

async function populateMissingMetadata(
  tokens: Awaited<ReturnType<typeof getRealmOwnershipInventory>>["tokens"],
) {
  const nodeUrl =
    env.VITE_PUBLIC_NODE_URL ??
    (env.VITE_PUBLIC_CHAIN === "sepolia"
      ? "https://api.cartridge.gg/x/starknet/sepolia"
      : "https://api.cartridge.gg/x/starknet/mainnet");
  const provider = new RpcProvider({ nodeUrl });
  const contract = new Contract({
    abi: RealmMetadataABI,
    address: CollectionAddresses.realms[SUPPORTED_L2_CHAIN_ID] as string,
    providerOrAccount: provider,
  });
  return hydrateRealmMetadata(tokens, {
    read: (tokenId) =>
      readRealmMetadata(
        (entrypoint, calldata) => contract.call(entrypoint, calldata),
        tokenId,
      ),
    cache: async (tokenId, metadata) => {
      await db
        .insert(starknetRealmMetadata)
        .values({
          _id: tokenId,
          metadata,
        })
        .onConflictDoUpdate({
          target: starknetRealmMetadata._id,
          set: { metadata },
        });
    },
  });
}

export const getRealmInventory = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GetRealmInventoryInput.parse(input))
  .handler(async (ctx): Promise<RealmInventoryResponse> => {
    const { address } = ctx.data;
    if (!address) {
      return { status: "ready", tokens: [], checkpoint: null };
    }

    const inventory = await getRealmOwnershipInventory(
      db,
      normalizeRealmOwnerAddress(address),
    );

    if (inventory.status !== "ready") {
      return {
        status: inventory.status,
        checkpoint: inventory.checkpoint,
        tokens: [],
      };
    }

    const tokens = await populateMissingMetadata(inventory.tokens);

    return {
      status: inventory.status,
      checkpoint: inventory.checkpoint,
      tokens: tokens.map((token) => ({
        token_id: Number(token.token_id),
        metadata: token.metadata ?? undefined,
        metadata_status: token.metadata_status,
      })),
    };
  });

export const getRealmInventoryQueryOptions = (
  input: z.infer<typeof GetRealmInventoryInput>,
) =>
  queryOptions({
    queryKey: ["realmInventory", input.address],
    queryFn: async (): Promise<RealmInventoryResponse> =>
      getRealmInventory({ data: { address: input.address } }),
    enabled: !!input.address,
    refetchInterval: REALM_INVENTORY_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
