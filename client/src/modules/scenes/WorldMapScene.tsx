// @ts-ignore
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
import { useGetCaravansWithResourcesChest } from "../../hooks/helpers/useResources.js";
import { useMemo, useRef } from "react";
import { useCaravan } from "../../hooks/helpers/useCaravans.js";
import useRealmStore from "../../hooks/store/useRealmStore.js";
import { useGetRealm } from "../../hooks/helpers/useRealm.js";
import { getRealmPositionFromContractPosition } from "../../utils/utils.js";
import Bank from "../../components/worldmap/banks/models/Bank2.js";
import banks from "../../data/banks.json";

export const WorldMapScene = () => {
  const worldRef = useRef();

  const hyperstructures = useUIStore((state) => state.hyperstructures);

  const { getCaravanInfo } = useCaravan();
  const { caravansAtPositionWithInventory: caravanIds } = useGetCaravansWithResourcesChest();
  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const destinations = useMemo(() => {
    if (!realm) return [];
    return caravanIds
      .map((caravanId) => {
        const { destination: from } = getCaravanInfo(caravanId);
        if (from) {
          return {
            from: getRealmPositionFromContractPosition(from),
            to: getRealmPositionFromContractPosition(realm.position),
          };
        }
      })
      .filter(Boolean);
  }, [caravanIds, realm]);

  return (
    <>
      <Flags />
      {/* <TransformControls mode="translate" onChange={(e) => console.log(e?.target?.object?.position)}>
        <mesh>
          <boxGeometry args={[10, 10, 10]} />
          <meshBasicMaterial color="red" />
        </mesh>
      </TransformControls> */}
      <WorldMap ref={worldRef} />
      <HyperstructureStarted />
      {/* {hyperstructures.map((hyperstructure, i) => {
        if (hyperstructure) {
          if (hyperstructure.level >= 3) {
            return (
              <HyperstructureFinished
                key={i}
                position={[hyperstructure.uiPosition.x, hyperstructure.uiPosition.y, hyperstructure.uiPosition.z]}
              />
            );
          } else if (hyperstructure.level == 2) {
            return (
              <></>
              // <HyperstructureHalf
              //   key={i}
              //   hyperstructure={hyperstructure}
              //   position={[hyperstructure.uiPosition.x, hyperstructure.uiPosition.y, hyperstructure.uiPosition.z]}
              // />
            );
          } else {
            return (
              <HyperstructureStarted

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
