import { entryHref } from "../game-links";
import { useDirectory } from "../herald";
import { chooseSeason } from "../season";

export const useDevconEntry = (): string | null => {
  const directory = useDirectory();
  if (directory.isError) return "/";
  if (!directory.data) return null;
  const season = chooseSeason(directory.data.games, false);
  return season ? entryHref(season, "play") : "/";
};
