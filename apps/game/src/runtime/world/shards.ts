import { getShard, openShard, type Shard } from "@bibliothecadao/eternum/shard";

import { nativeFactSchemaIdentity } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { fetchDirectory, type DirectoryShard } from "./directory";

let listing: Promise<DirectoryShard | null> | null = null;

/** Our directory, read once per page; a read that failed is retried by the next caller. */
const directoryListing = (): Promise<DirectoryShard | null> =>
  (listing ??= fetchDirectory().catch((error: unknown) => {
    listing = null;
    throw error;
  }));

export const requireOpenShard = async (chainId: string): Promise<Shard> => {
  const listed = await directoryListing();
  if (!listed || BigInt(listed.chainId) !== BigInt(chainId))
    throw new Error(`Chain ${chainId} is not the chain our directory lists`);
  const open = getShard();
  return open && new URL(open.url).href === new URL(listed.url).href ? open : openListedShard(listed);
};

export const openDirectoryShard = async (): Promise<Shard | null> => {
  const listed = await directoryListing();
  return listed && requireOpenShard(listed.chainId);
};

/**
 * Opened from the manifest our directory already holds, so entering a game waits on no second read of its shard; a shard
 * the directory could not read is asked itself. Validate before registry insertion: a shard whose manifest names another
 * chain than its listed one owns no route.
 */
const openListedShard = (listed: DirectoryShard): Promise<Shard> =>
  openShard(
    listed.url,
    nativeFactSchemaIdentity,
    (shard) => {
      if (BigInt(listed.chainId) !== BigInt(shard.chainId))
        throw new Error(`Shard ${shard.url} does not serve its listed chain ${listed.chainId}`);
    },
    listed.manifest ?? undefined,
  );
