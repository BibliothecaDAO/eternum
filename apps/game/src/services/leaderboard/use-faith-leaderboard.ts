import { usePlayerNames } from "@/hooks/use-player-profile";
import { useMemo } from "react";

import { buildFaithLeaderboard, buildWonderFaithDetail } from "./faith-leaderboard-service";
import { useFaithReadModels } from "./use-faith-read-models";

/** The wonders ranked by faith, each owner named by the one rule: built again when the facts or a name changes. */
export const useFaithLeaderboard = () => {
  const rows = useFaithReadModels();
  const names = usePlayerNames();
  return useMemo(() => buildFaithLeaderboard(rows, names.text), [rows, names]);
};

/** One wonder's faith and followers, its owner named by the one rule: built again when the facts or a name changes. */
export const useWonderFaithDetail = (wonderId: bigint | number | string) => {
  const rows = useFaithReadModels();
  const names = usePlayerNames();
  return useMemo(() => buildWonderFaithDetail(rows, wonderId, names.text), [rows, wonderId, names]);
};
