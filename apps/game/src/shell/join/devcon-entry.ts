import { campaignOfPreset } from "@/services/home-claim-rules";

import { entryHref } from "../game-links";
import { useDirectory } from "../herald";
import { chooseSeason } from "../season";
import { DEVCON } from "./devcon";

/**
 * The running Devcon season's entry, where its Realm step adds a ticket to a home; null while the directory has not
 * answered. Play only once it has answered with no Devcon game, or failed (Play says why).
 */
export const useDevconEntry = (): string | null => {
  const directory = useDirectory();
  if (directory.isError) return "/";
  if (!directory.data) return null;
  const season = chooseSeason(
    directory.data.games.filter((game) => campaignOfPreset(game.preset_id) === DEVCON.campaign),
    false,
  );
  return season ? entryHref(season, "play") : "/";
};
