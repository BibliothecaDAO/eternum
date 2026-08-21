export type RealmMetadataStatus = "ready" | "pending" | "unavailable";

interface RealmMetadataRecord {
  token_id: string;
  metadata: string | null;
}

interface RealmMetadataDependencies {
  read: (tokenId: string) => Promise<string>;
  cache: (tokenId: string, metadata: string) => Promise<void>;
}

const DEFAULT_MAX_READS = 50;
const DEFAULT_READ_CONCURRENCY = 5;

export async function hydrateRealmMetadata<T extends RealmMetadataRecord>(
  tokens: T[],
  dependencies: RealmMetadataDependencies,
): Promise<(T & { metadata_status: RealmMetadataStatus })[]> {
  const missing = tokens
    .filter((token) => !token.metadata)
    .slice(0, DEFAULT_MAX_READS);
  const outcomes = new Map<
    string,
    { metadata: string | null; status: RealmMetadataStatus }
  >();

  for (
    let offset = 0;
    offset < missing.length;
    offset += DEFAULT_READ_CONCURRENCY
  ) {
    const batch = missing.slice(offset, offset + DEFAULT_READ_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (token) => {
        const metadata = await dependencies.read(token.token_id);
        try {
          await dependencies.cache(token.token_id, metadata);
        } catch {
          // Cache persistence must not hide metadata that was read successfully.
        }
        return { tokenId: token.token_id, metadata };
      }),
    );

    results.forEach((result, index) => {
      const token = batch[index];
      if (!token) return;

      if (result.status === "fulfilled") {
        outcomes.set(token.token_id, {
          metadata: result.value.metadata,
          status: "ready",
        });
      } else {
        outcomes.set(token.token_id, {
          metadata: null,
          status: "unavailable",
        });
      }
    });
  }

  return tokens.map((token) => {
    if (token.metadata) {
      return { ...token, metadata_status: "ready" };
    }

    const outcome = outcomes.get(token.token_id);
    return {
      ...token,
      metadata: outcome?.metadata ?? null,
      metadata_status: outcome?.status ?? "pending",
    };
  });
}
