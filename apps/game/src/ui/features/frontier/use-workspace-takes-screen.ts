import { useUIStore } from "@/hooks/store/use-ui-store";
import { useEffect } from "react";

/**
 * A Frontier workspace (the muster, research) takes the screen: while one opens, the tapped tile or plot is let go,
 * so its sheet (and a build ghost with it) never shows under the workspace.
 */
export const useWorkspaceTakesScreen = (): void => {
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  useEffect(() => {
    setSelectedHex(null);
    setSelectedBuildingHex(null);
  }, [setSelectedBuildingHex, setSelectedHex]);
};
