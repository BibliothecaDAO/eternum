import { useEffect, useState } from "react";

import { GameClientApp } from "../../game-client-app";
import { FirstFrame } from "../../shell/first-frame";
import { SceneRoute } from "../../scene-route";
import { installLabChain } from "./lab-chain";
import { keptLabGame, LAB_SCENARIOS } from "./lab-games";

/**
 * Dev only: a game route on the lab shard. Opened from /lab/game, the tab's chain is already there; reloaded (a player's
 * refresh, or the renderer's own boot after a lost GPU), it is installed again for the scenario this tab started, its
 * clock going on, before the game client reads the directory. The game itself is the one every route plays.
 */
export const LabGameRoute = () => {
  const [state, setState] = useState<"installing" | "ready" | string>("installing");
  useEffect(() => {
    const kept = keptLabGame();
    const scenario = kept && LAB_SCENARIOS[kept.name];
    if (!kept || !scenario) return setState("This tab started no lab game: open one from /lab/game.");
    installLabChain(scenario, kept.startedAt).then(
      () => setState("ready"),
      (error: unknown) => setState(String(error)),
    );
  }, []);
  if (state === "installing") return <FirstFrame />;
  if (state !== "ready")
    return (
      <div className="lab-loading" role="status">
        {state}
      </div>
    );
  return (
    <SceneRoute fallback={<FirstFrame />}>
      <GameClientApp />
    </SceneRoute>
  );
};
