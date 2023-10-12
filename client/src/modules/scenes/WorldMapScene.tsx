// @ts-ignore
import { Model as WorldMap } from "../../components/worldmap/WorldMap.jsx";
// @ts-ignore
import { Flags } from "../../components/worldmap/Flags.jsx";
import HyperstructureStarted from "../../components/worldmap/hyperstructures/models/HyperstructureStarted";
import HyperstructureHalf from "../../components/worldmap/hyperstructures/models/HyperstructureHalf";
import HyperstructureFinished from "../../components/worldmap/hyperstructures/models/HyperstructureFinished";
import useUIStore from "../../hooks/store/useUIStore.js";
// import { TransformControls } from "@react-three/drei";

export const WorldMapScene = () => {
  const hyperstructures = useUIStore((state) => state.hyperstructures);

  return (
    <>
      <Flags />
      <WorldMap />
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
        return <></>;
      })}
      {/* <TransformControls mode="translate" onObjectChange={(e) => console.log(e?.target.object.position)}>
        <Hyperstructure />
      </TransformControls> */}
    </>
  );
};
