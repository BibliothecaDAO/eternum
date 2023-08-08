// @ts-ignore
import { Model } from "../../components/worldmap/WorldMap.jsx";
// @ts-ignore
import { Flags } from "../../components/worldmap/Flags.jsx";
import realmsJson from "../../geodata/realms.json";
import { Suspense, useEffect, useState } from "react";
import { Html, useProgress } from "@react-three/drei";

export const WorldMapScene = () => {
  return (
    <>
      <Flags />
      <Model />
    </>
  );
};
