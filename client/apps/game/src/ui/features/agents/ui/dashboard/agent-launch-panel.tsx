import { useState } from "react";
import { Rocket } from "lucide-react";

import Button from "@/ui/design-system/atoms/button";

export const AgentLaunchPanel = ({
  worldId,
  worldLabel,
  isPending,
  onLaunch,
}: {
  worldId: string;
  worldLabel: string;
  isPending: boolean;
  onLaunch: (input: { displayName?: string }) => Promise<void> | void;
}) => {
  const [displayName, setDisplayName] = useState("");

  return (
    <div className="rounded-3xl border border-gold/20 bg-black/55 p-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-gold/15 p-3">
          <Rocket className="h-5 w-5 text-gold" />
        </div>
        <div>
          <h2 className="font-cinzel text-xl text-gold">Launch Agent</h2>
          <p className="text-sm text-gold/65">Create your agent for {worldLabel}.</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-2xl border border-gold/10 bg-black/35 p-4 text-sm text-gold/70">
          Launching creates and prepares your world agent. It does not start autonomous match behavior yet. You will
          enable autonomy later from inside the game.
        </div>

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-gold/55">Display name</div>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="My Agent"
            className="w-full rounded-xl border border-gold/15 bg-black/35 px-4 py-3 text-sm text-gold outline-none placeholder:text-gold/35 focus:border-gold/40"
          />
        </label>

        <Button
          className="w-full"
          disabled={isPending}
          onClick={() =>
            void onLaunch({
              displayName: displayName.trim() || undefined,
            })
          }
        >
          {isPending ? "Launching..." : `Launch for ${worldLabel}`}
        </Button>
      </div>
    </div>
  );
};
