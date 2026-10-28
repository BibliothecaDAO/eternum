import { nativeProgressionRules } from "../../../../../../../config/source/common/progression";
import { frontierPreset } from "../../../../../../../config/source/frontier/native";

export const frontierArmyRules = (gameId = 1) => ({
  game_id: gameId,
  ...nativeProgressionRules(frontierPreset.progression),
});
