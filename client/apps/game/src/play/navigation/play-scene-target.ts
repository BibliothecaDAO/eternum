import type { PlayScene } from "./play-route";

export const resolvePlaySceneTarget = (
  requestedScene: PlayScene | null | undefined,
  fastTravelEnabled: boolean,
): PlayScene => {
  if (requestedScene === "travel" && !fastTravelEnabled) {
    return "map";
  }

  return requestedScene ?? "map";
};
