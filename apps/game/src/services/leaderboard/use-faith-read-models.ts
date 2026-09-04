import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { useMemo } from "react";

import type { FaithReadModels } from "./faith-leaderboard-service";

/** The world slices are the subscription; the bridge already narrows structures, wonder faith and faithful structures to the active game. */
export const useFaithReadModels = (): FaithReadModels => {
  const structures = useWorldSlicesStore((state) => state.structures);
  const wonderFaith = useWorldSlicesStore((state) => state.wonderFaith);
  const faithfulStructures = useWorldSlicesStore((state) => state.faithfulStructures);
  const addressNames = useWorldSlicesStore((state) => state.addressNames);

  return useMemo(
    () => ({ structures, wonderFaith, faithfulStructures, addressNames }),
    [addressNames, faithfulStructures, structures, wonderFaith],
  );
};
