// @ts-ignore
import { Model as WorldMap } from "../../components/worldmap/WorldMap.jsx";
// @ts-ignore
import { Flags } from "../../components/worldmap/Flags.jsx";
import { Model as Hyperstructure } from "../../components/worldmap/Hyperstructure";

export const WorldMapScene = () => {
  return (
    <>
      <Flags />
      <WorldMap />
      <Hyperstructure />
    </>
  );
};
