import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { addPastedShard } from "@/runtime/world/shards";

import { DIRECTORY_QUERY_KEY } from "./herald";
import { Button } from "@/ui/design-system/kit/button";

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
          className="h-12 min-w-0 flex-1 rounded-xl border-2 border-kit-line bg-kit-ground px-3 text-[15px] text-kit-cream outline-none placeholder:text-kit-muted focus:border-kit-peach"
        />
        <Button role="outline" type="submit" word="Open shard" loading={isOpening ? "Opening…" : undefined} />
      </div>
      {[...failures.map((failure) => `${failure.url}: ${failure.error.message}`), ...(error ? [error] : [])].map(
        (message) => (
          <p key={message} role="alert" className="text-[13px] text-kit-red">
            {message}
          </p>
        ),
      )}
    </form>
  );
};
