import { useGame } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { firstBuildPlot } from "@/three/scenes/hexception-first-build-plot";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useEffect, useRef } from "react";

import { openPlots } from "./build-sheet";

type PlotStore = Parameters<typeof openPlots>[0];

const openBuildOnFirstPlot = (store: PlotStore, realm: NativeRows["Structure"]) => {
  const plot = firstBuildPlot(openPlots(store, realm));
  if (!plot) return;
  useUIStore.getState().setSelectedBuildingHex({
    structureId: safeInteger(realm.entity_id),
    innerCol: plot.col,
    innerRow: plot.row,
  });
};

export const useBuildOpensOnEntering = (realm: NativeRows["Structure"] | null) => {
  const { setup } = useGame();
  const realmRef = useRef(realm);
  realmRef.current = realm;
  const entered = realm !== null;
  useEffect(() => {
    if (entered && realmRef.current) openBuildOnFirstPlot(setup.store, realmRef.current);
  }, [entered, setup.store]);
};
