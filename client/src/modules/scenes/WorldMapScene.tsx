// @ts-nocheck
import WorldMap from "../../components/worldmap/WorldMap.jsx";
// @ts-ignore
import { Flags } from "../../components/worldmap/Flags.jsx";
import HyperstructureStarted from "../../components/worldmap/hyperstructures/models/HyperstructureStarted";
import HyperstructureHalf from "../../components/worldmap/hyperstructures/models/HyperstructureHalf";
import HyperstructureFinished from "../../components/worldmap/hyperstructures/models/HyperstructureFinished";
import useUIStore from "../../hooks/store/useUIStore.js";
// import { TransformControls } from "@react-three/drei";
// @ts-ignore
import Arcs from "../../components/worldmap/Arcs.jsx";
import { useResources } from "../../hooks/helpers/useResources.js";
import { useEffect, useMemo, useRef } from "react";
import { useCaravan } from "../../hooks/helpers/useCaravans.js";
import useRealmStore from "../../hooks/store/useRealmStore.js";
import { useGetRealm } from "../../hooks/helpers/useRealm.js";
import { getUIPositionFromContractPosition } from "../../utils/utils.js";
import Bank from "../../components/worldmap/banks/models/Bank2.js";
import banks from "../../data/banks.json";
import { Map } from "../../components/worldmap/HexGrid.js";
import { useRoute } from "wouter";
// import { Castles } from "../../components/worldmap/Castles.js";

export const WorldMapScene = () => {
  const worldRef = useRef();

  const hyperstructures = useUIStore((state) => state.hyperstructures);
  const { getCaravansWithResourcesChest } = useResources();
  const [isMapView] = useRoute("/map");
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  useEffect(() => {
    setTimeout(() => {
      setIsLoadingScreenEnabled(false);
    }, 300);
  }, []);

  const { getCaravanInfo } = useCaravan();
  const caravanIds = getCaravansWithResourcesChest();
  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const destinations = useMemo(() => {
    if (!realm) return [];
    return caravanIds
      .map((caravanId) => {
        const { destination: from } = getCaravanInfo(caravanId);
        if (from) {
          return {
            from: getUIPositionFromContractPosition(from),
            to: getUIPositionFromContractPosition(realm.position),
          };
        }
      })
      .filter(Boolean);
  }, [caravanIds, realm]);

  return (
    <>
      {/* <Castles /> */}
      {/* <Flags /> */}
      {/* <TransformControls mode="translate" onChange={(e) => console.log(e?.target?.object?.position)}>
        <mesh>
          <boxGeometry args={[10, 10, 10]} />
          <meshBasicMaterial color="red" />
        </mesh>
      </TransformControls> */}
      {/* <WorldMap ref={worldRef} /> */}
      {/* <HyperstructureStarted /> */}
      {!showBlankOverlay && isMapView && <Map />}
      {/* {hyperstructures.map((hyperstructure, i) => {
        if (hyperstructure) {
          if (hyperstructure.completed) {
            let uiPosition = hyperstructure.uiPosition;
            return <HyperstructureFinished key={i} scale={1.8} position={[uiPosition.x, 15, -uiPosition.y]} />;
          } else if (hyperstructure.progress > 50) {
            return (
              <HyperstructureHalf
                key={i}
                scale={100}
                hyperstructure={hyperstructure}
                position={[hyperstructure.uiPosition.x, hyperstructure.uiPosition.y, hyperstructure.uiPosition.z]}
              />
            );
          } else {
            return (
              <HyperstructureStarted
                key={i}
                hyperstructure={hyperstructure}
                scale={5}
                // position={[hyperstructure.uiPosition.x, hyperstructure.uiPosition.y, hyperstructure.uiPosition.z]}
                position={[0, 0, 0]}
              />
            );
          }
        }
        return null;
      })} */}
      {/* {banks.map((bank, i) => {
        return <Bank key={i} position={[bank.x, bank.y, bank.z]} />;
      })} */}
      {/* <Arcs paths={destinations} /> */}
    </>
  );
};
