import type { RealmOwnershipInventoryStatus } from "@realms-world/db";
import { RealmMetadataABI } from "@/abi/L2/RealmMetadata";
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

const MAX_METADATA_READS_PER_REQUEST = 50;
const METADATA_READ_CONCURRENCY = 5;

export interface RawTokenBalanceWithMetadata {
  token_id: number;
  balance: string;
  contract_address: string;
  token_owner: string;
  metadata?: string;
}

export interface AccountTokenInventory {
  status: RealmOwnershipInventoryStatus;
  tokens: RawTokenBalanceWithMetadata[];
  checkpoint: {
    blockNumber: string;
    blockTimestamp: string;
  } | null;
}

const GetAccountTokensInput = z.object({
  address: z.string().optional(),
  collectionAddress: z.string().optional(),
  itemsPerPage: z.number().optional(),
  page: z.number().optional(),
});

async function populateMissingMetadata(
  tokens: Awaited<ReturnType<typeof getRealmOwnershipInventory>>["tokens"],
) {
  const missing = tokens
    .filter((token) => !token.metadata)
    .slice(0, MAX_METADATA_READS_PER_REQUEST);
  if (missing.length === 0) return tokens;

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
  const metadataByToken = new Map<string, string>();

  for (
    let offset = 0;
    offset < missing.length;
    offset += METADATA_READ_CONCURRENCY
  ) {
    const batch = missing.slice(offset, offset + METADATA_READ_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (token) => {
        return {
          tokenId: token.token_id,
          metadata: await readRealmMetadata(
            (entrypoint, calldata) => contract.call(entrypoint, calldata),
            token.token_id,
          ),
        };
      }),
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      metadataByToken.set(result.value.tokenId, result.value.metadata);
      await db
        .insert(starknetRealmMetadata)
        .values({
          _id: result.value.tokenId,
          metadata: result.value.metadata,
        })
        .onConflictDoUpdate({
          target: starknetRealmMetadata._id,
          set: { metadata: result.value.metadata },
        });
    }
  }

  return tokens.map((token) => ({
    ...token,
    metadata: token.metadata ?? metadataByToken.get(token.token_id) ?? null,
  }));
}

export const getAccountTokens = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GetAccountTokensInput.parse(input))
  .handler(async (ctx): Promise<AccountTokenInventory> => {
    const { address, collectionAddress = "" } = ctx.data;
    if (!address) {
      return { status: "ready", tokens: [], checkpoint: null };
    }

    const inventory = await getRealmOwnershipInventory(
      db,
      normalizeRealmOwnerAddress(address),
    );

    const tokens =
      inventory.status === "ready"
        ? await populateMissingMetadata(inventory.tokens)
        : inventory.tokens;

    return {
      status: inventory.status,
      checkpoint: inventory.checkpoint,
      tokens: tokens.map((token) => ({
        token_id: Number(token.token_id),
        balance: "1",
        contract_address: collectionAddress,
        token_owner: token.owner,
        metadata: token.metadata ?? undefined,
      })),
    };
  });

export const getAccountTokensQueryOptions = (
  input: z.infer<typeof GetAccountTokensInput>,
) =>
  queryOptions({
    queryKey: ["getAccountTokens", input.address, input.collectionAddress],
    queryFn: async (): Promise<AccountTokenInventory> =>
      getAccountTokens({
        data: {
          address: input.address,
          collectionAddress: input.collectionAddress,
        },
      }),
    enabled: !!input.address,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
