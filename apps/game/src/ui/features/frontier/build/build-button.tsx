import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { firstBuildPlot } from "@/three/scenes/hexception-first-build-plot";
import { Icon } from "@/ui/design-system/icon";
import { BUILD } from "@/ui/design-system/kit/words";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useEffect, useRef } from "react";

import { openPlots } from "./build-sheet";

const PLOT_MODELS = ["Building"] as const;

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

export const BuildButton = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  useNativeRevision(PLOT_MODELS);
  if (!firstBuildPlot(openPlots(setup.store, realm))) return null;
  const openBuildSheet = () => openBuildOnFirstPlot(setup.store, realm);
  return (
    <button
      type="button"
      data-build-button=""
      data-kind="primary"
      className="ui-button frontier-build-button pointer-events-auto"
      onClick={openBuildSheet}
    >
      <Icon name="build" size={34} />
      <span className="frontier-build-button__label">{BUILD}</span>
    </button>
  );
};
