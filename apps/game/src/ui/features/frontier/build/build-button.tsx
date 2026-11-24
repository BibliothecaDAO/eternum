import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { firstBuildPlot } from "@/three/scenes/hexception-first-build-plot";
import { Icon } from "@/ui/design-system/icon";
import { BUILD } from "@/ui/design-system/kit/words";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { openPlots } from "./build-sheet";

const PLOT_MODELS = ["Building"] as const;

export const BuildButton = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  useNativeRevision(PLOT_MODELS);
  const plot = firstBuildPlot(openPlots(setup.store, realm));
  if (!plot) return null;
  const openBuildSheet = () =>
    useUIStore.getState().setSelectedBuildingHex({
      structureId: safeInteger(realm.entity_id),
      innerCol: plot.col,
      innerRow: plot.row,
    });
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
