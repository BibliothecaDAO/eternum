import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { useMemo } from "react";
import { getGameModeConfig } from "./index";
import { resolveGameModeFromBlitzFlag, type ResolvedGameMode } from "./resolved-mode";
import { worldConfigKey } from "@/dojo/game-scope";

// Resolved per hook call, not at module level: on the s2 single world the row
// is keyed by the active game id, which bootstrap sets after modules load.
const useWorldConfigEntityId = () => useMemo(() => worldConfigKey(), []);

export const useResolvedWorldGameMode = (): ResolvedGameMode => {
  const {
    setup: { components },
  } = useDojo();

  const worldConfig = useComponentValue(components.WorldConfig, useWorldConfigEntityId());
  const worldBlitzModeOnFlag = worldConfig?.blitz_mode_on;

  return useMemo(() => resolveGameModeFromBlitzFlag(worldBlitzModeOnFlag), [worldBlitzModeOnFlag]);
};

export const useGameModeConfig = () => {
  const {
    setup: { components },
  } = useDojo();

  const worldConfig = useComponentValue(components.WorldConfig, useWorldConfigEntityId());
  const worldBlitzModeOnFlag = worldConfig?.blitz_mode_on;

  return useMemo(() => getGameModeConfig({ blitzModeOn: worldBlitzModeOnFlag }), [worldBlitzModeOnFlag]);
};
