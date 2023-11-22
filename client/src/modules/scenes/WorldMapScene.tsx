// @ts-ignore
import WorldMap from "../../components/worldmap/WorldMap.jsx";
// @ts-ignore
import { Flags } from "../../components/worldmap/Flags.jsx";
import HyperstructureStarted from "../../components/worldmap/hyperstructures/models/HyperstructureStarted";
import HyperstructureHalf from "../../components/worldmap/hyperstructures/models/HyperstructureHalf";
import HyperstructureFinished from "../../components/worldmap/hyperstructures/models/HyperstructureFinished";
import useUIStore from "../../hooks/store/useUIStore.js";
// import { TransformControls } from "@react-three/drei";
import Arcs from "../../components/worldmap/Arcs.jsx";
import { useGetCaravansWithResourcesChest } from "../../hooks/helpers/useResources.js";
import { useMemo, useRef } from "react";
import { useCaravan } from "../../hooks/helpers/useCaravans.js";
import useRealmStore from "../../hooks/store/useRealmStore.js";
import { useGetRealm } from "../../hooks/helpers/useRealm.js";
import { getRealmPositionFromContractPosition } from "../../utils/utils.js";

export const WorldMapScene = () => {
  const worldRef = useRef();

  const hyperstructures = useUIStore((state) => state.hyperstructures);
  const { getCaravanInfo } = useCaravan();
  const { caravansAtPositionWithInventory: caravanIds } = useGetCaravansWithResourcesChest();
  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const destinations = useMemo(() => {
    if (!realm) return [];
    return caravanIds.map((caravanId) => {
      const { destination: from } = getCaravanInfo(caravanId);
      return {
        from: getRealmPositionFromContractPosition(from),
        to: getRealmPositionFromContractPosition(realm.position),
      };
    });
  }, [caravanIds, realm]);

  return (
    <>
      <Flags />
      <WorldMap ref={worldRef} />
      {hyperstructures.map((hyperstructure, i) => {
        if (hyperstructure) {
          if (hyperstructure.progress == 100) {
            return (
              <HyperstructureFinished
                key={i}
                position={[hyperstructure.uiPosition.x, hyperstructure.uiPosition.y, hyperstructure.uiPosition.z]}
              />
            );
          } else if (hyperstructure.progress >= 50) {
            return (
              <HyperstructureHalf
                key={i}
                position={[hyperstructure.uiPosition.x, hyperstructure.uiPosition.y, hyperstructure.uiPosition.z]}
              />
            );
          } else {
            return (
              <HyperstructureStarted
                key={i}
                position={[hyperstructure.uiPosition.x, hyperstructure.uiPosition.y, hyperstructure.uiPosition.z]}
                hyperstructure={hyperstructure}
              />
            );
          }
        }
        return null;
      })}
      <Arcs paths={destinations} />
    </>
  );
};
