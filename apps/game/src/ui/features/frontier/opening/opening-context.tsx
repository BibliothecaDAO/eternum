import { type ReactNode, useEffect, useLayoutEffect } from "react";
import { create } from "zustand";

import { type Opened, type OpeningPart, partShown } from "./opening";

const useOpened = create<{ opened: Opened }>(() => ({ opened: "all" }));

/** Publishes the HUD's reading to every part that waits on a moment, and takes it back when the HUD is gone. */
export const OpeningProvider = ({ opened, children }: { opened: Opened; children: ReactNode }) => {
  useLayoutEffect(() => {
    useOpened.setState({ opened });
  }, [opened]);
  useEffect(() => {
    return () => {
      useOpened.setState({ opened: "all" });
    };
  }, []);
  return children;
};

/** Whether the HUD shows a part now. */
export const usePartShown = (part: OpeningPart): boolean => useOpened((state) => partShown(state.opened, part));

/** A part of the HUD that waits on its moment: drawn once the player has reached it. */
export const OpeningPartGate = ({ part, children }: { part: OpeningPart; children: ReactNode }) =>
  usePartShown(part) ? children : null;
