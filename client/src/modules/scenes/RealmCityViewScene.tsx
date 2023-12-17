import { Suspense, useEffect } from "react";
import RealmLandscape from "../../components/cityview/RealmLandscape";
import { Model } from "../../components/cityview/CityView";
import useUIStore from "../../hooks/store/useUIStore";
import { BakeShadows } from "@react-three/drei";
import RealmBuildings from "../../components/cityview/RealmBuildings";

export const RealmCityViewScene = () => {
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  useEffect(() => {
    setIsLoadingScreenEnabled(false);
  }, []);
  return (
    <>
      <Suspense fallback={null}>
        <RealmLandscape />
        <RealmBuildings />
        <BakeShadows />
      </Suspense>
      {/* <Model /> */}
    </>
  );
};
