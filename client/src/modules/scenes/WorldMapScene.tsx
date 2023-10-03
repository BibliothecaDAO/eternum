// @ts-ignore
import { Model as WorldMap } from "../../components/worldmap/WorldMap.jsx";
// @ts-ignore
import { Flags } from "../../components/worldmap/Flags.jsx";
import { Model as Hyperstructure } from "../../components/worldmap/hyperstructures/Hyperstructure";
// import { TransformControls } from "@react-three/drei";

export const HYPERSTRUCTURES_POSITIONS = [
  {
    x: -105.95073562656883,
    y: 0.528415243525413,
    z: -35.36402704025532,
  },
  {
    x: -90.60024070188028,
    y: 0.528415243525413,
    z: 7.335662077462935,
  },
  {
    x: -119.45899643774253,
    y: 0.528415243525413,
    z: 22.36329531857441,
  },
  {
    x: -70.25751302528872,
    y: 0.528415243525413,
    z: -32.37931467429666,
  },
  {
    x: -22.73312316195737,
    y: 0.528415243525413,
    z: -28.231658318595414,
  },
  {
    x: -14.97911593658031,
    y: 0.528415243525413,
    z: -3.5918721344570272,
  },
  {
    x: -38.79051261810327,
    y: 0.528415243525413,
    z: 19.345213249091845,
  },
  {
    x: -14.738945388790135,
    y: 0.528415243525413,
    z: 30.327674620452598,
  },
  {
    x: 15.411695237142771,
    y: 0.528415243525413,
    z: 37.15702249267392,
  },
  {
    x: 27.244358277941554,
    y: 0.528415243525413,
    z: -8.70354515951557,
  },
  {
    x: 10.681895243570205,
    y: 0.528415243525413,
    z: -39.09521854207338,
  },
  {
    x: 82.19099990211434,
    y: 0.528415243525413,
    z: -34.185218206690024,
  },
  {
    x: 104.40780672185382,
    y: 0.528415243525413,
    z: -10.210581383051249,
  },
  {
    x: 70.95170623206306,
    y: 0.528415243525413,
    z: 8.4363296832867,
  },
  {
    x: 111.91588278029236,
    y: 0.528415243525413,
    z: 32.71779102660024,
  },
  {
    x: 64.51836447255958,
    y: 0.528415243525413,
    z: 47.55800814381176,
  },
];

export const WorldMapScene = () => {
  return (
    <>
      <Flags />
      <WorldMap />
      {HYPERSTRUCTURES_POSITIONS.map((pos, i) => (
        <Hyperstructure key={i} position={[pos.x, pos.y, pos.z]} />
      ))}
      {/* <TransformControls mode="translate" onObjectChange={(e) => console.log(e?.target.object.position)}>
        <Hyperstructure />
      </TransformControls> */}
    </>
  );
};
