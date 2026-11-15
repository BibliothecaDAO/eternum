import { createContext, type ReactNode, useContext } from "react";

import { type Opened, type OpeningPart, partShown } from "./opening";

/** Outside the game's HUD every part shows: only the Frontier HUD provides what its player has reached. */
const OpenedContext = createContext<Opened>("all");

export const OpeningProvider = ({ opened, children }: { opened: Opened; children: ReactNode }) => (
  <OpenedContext.Provider value={opened}>{children}</OpenedContext.Provider>
);

/** Whether the HUD shows a part now. */
export const usePartShown = (part: OpeningPart): boolean => partShown(useContext(OpenedContext), part);

/** A part of the HUD that waits on its moment: drawn once the player has reached it. */
export const OpeningPartGate = ({ part, children }: { part: OpeningPart; children: ReactNode }) =>
  usePartShown(part) ? children : null;
