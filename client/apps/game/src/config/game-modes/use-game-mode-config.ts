import { useDojo } from "@bibliothecadao/react";
import { WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { getGameModeConfig } from "./index";
import { resolveGameModeFromBlitzFlag, type ResolvedGameMode } from "./resolved-mode";

const WORLD_CONFIG_ENTITY_ID = getEntityIdFromKeys([WORLD_CONFIG_ID]);

export const useResolvedWorldGameMode = (): ResolvedGameMode => {
  const {
    setup: { components },
  } = useDojo();

  const worldConfig = useComponentValue(components.WorldConfig, WORLD_CONFIG_ENTITY_ID);
  const worldBlitzModeOnFlag = worldConfig?.blitz_mode_on;

  return useMemo(() => resolveGameModeFromBlitzFlag(worldBlitzModeOnFlag), [worldBlitzModeOnFlag]);
};

export const useGameModeConfig = () => {
  const {
    setup: { components },
  } = useDojo();

  const worldConfig = useComponentValue(components.WorldConfig, WORLD_CONFIG_ENTITY_ID);
  const worldBlitzModeOnFlag = worldConfig?.blitz_mode_on;

  return useMemo(() => getGameModeConfig({ blitzModeOn: worldBlitzModeOnFlag }), [worldBlitzModeOnFlag]);
};
