import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { WORLD_SUMMARY_QUERY_KEY, invalidateWorldListQueries } from "@/hooks/world-list-queries";
import { addPastedShard, openKnownShards } from "@/runtime/world/shards";

/** Opens another shard by its URL and names every shard this client could not open, with the reason. */
export const ShardUrlForm = () => {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const { data: failures = [] } = useQuery({
    queryKey: [...WORLD_SUMMARY_QUERY_KEY, "shard-failures"],
    queryFn: openKnownShards,
    staleTime: 25_000,
  });

  const openPastedShard = async (event: FormEvent) => {
    event.preventDefault();
    setIsOpening(true);
    setError(null);
    try {
      await addPastedShard(url.trim());
      setUrl("");
      await invalidateWorldListQueries(queryClient);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <form onSubmit={openPastedShard} className="flex flex-col gap-1 text-[11px] text-white/60">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Shard URL"
          type="url"
          required
          className="flex-1 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-white/80"
        />
        <button
          type="submit"
          disabled={isOpening}
          className="rounded-md border border-amber-500/30 px-3 py-1 text-amber-300/80 hover:bg-amber-500/10 disabled:opacity-50"
        >
          Open shard
        </button>
      </div>
      {[...failures.map((failure) => failure.error.message), ...(error ? [error] : [])].map((message) => (
        <p key={message} className="text-red-300/80">
          {message}
        </p>
      ))}
    </form>
  );
};
