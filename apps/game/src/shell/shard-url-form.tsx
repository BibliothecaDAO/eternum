import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { addPastedShard } from "@/runtime/world/shards";

import { DIRECTORY_QUERY_KEY } from "./herald";
import { GhostButton } from "./kit";

/** Opens another shard by its URL; the directory then lists that shard's games beside ours. */
export const ShardUrlForm = ({ failures }: { failures: { url: string; error: Error }[] }) => {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  const openPastedShard = async (event: FormEvent) => {
    event.preventDefault();
    setIsOpening(true);
    setError(null);
    try {
      await addPastedShard(url.trim());
      setUrl("");
      await queryClient.invalidateQueries({ queryKey: DIRECTORY_QUERY_KEY });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <form onSubmit={openPastedShard} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Shard URL"
          type="url"
          required
          aria-label="Shard URL"
          className="min-w-0 flex-1 rounded-lg border border-gold/30 bg-black/40 px-3 py-2 text-[13px] text-gold outline-none placeholder:text-gold/40 focus:border-gold"
        />
        <GhostButton type="submit" disabled={isOpening}>
          {isOpening ? "Opening…" : "Open shard"}
        </GhostButton>
      </div>
      {[...failures.map((failure) => `${failure.url}: ${failure.error.message}`), ...(error ? [error] : [])].map(
        (message) => (
          <p key={message} role="alert" className="text-[12px] text-danger">
            {message}
          </p>
        ),
      )}
    </form>
  );
};
