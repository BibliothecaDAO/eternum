import { useEffect, useState } from "react";

import { getActiveWorld, subscribeActiveWorldName } from "./store";
import type { WorldProfile } from "./types";

export const useActiveWorldProfile = (): WorldProfile | null => {
  const [activeWorld, setActiveWorld] = useState<WorldProfile | null>(() => getActiveWorld());

  useEffect(() => {
    return subscribeActiveWorldName(() => {
      setActiveWorld(getActiveWorld());
    });
  }, []);

  return activeWorld;
};
