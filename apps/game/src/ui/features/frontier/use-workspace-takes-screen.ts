import { useUIStore } from "@/hooks/store/use-ui-store";
import { useEffect, useRef } from "react";
import { create } from "zustand";

/** The workspace holding the screen now, by the token its sheet took on opening. */
const useOpenWorkspace = create<{ open: symbol | null }>(() => ({ open: null }));

/**
 * A Frontier workspace (deploy, research, the season board) takes the screen, and only one holds it: opening one
 * closes the workspace already open, and lets go of the tapped tile or plot, so neither its sheet nor a build ghost
 * shows under it.
 */
export const useWorkspaceTakesScreen = (close: () => void): void => {
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const token = Symbol("workspace");
    useOpenWorkspace.setState({ open: token });
    setSelectedHex(null);
    setSelectedBuildingHex(null);
    const unsubscribe = useOpenWorkspace.subscribe(({ open }) => {
      if (open !== token) closeRef.current();
    });
    return () => {
      unsubscribe();
      if (useOpenWorkspace.getState().open === token) useOpenWorkspace.setState({ open: null });
    };
  }, [setSelectedBuildingHex, setSelectedHex]);
};
