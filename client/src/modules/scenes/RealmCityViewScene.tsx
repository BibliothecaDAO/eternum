import { useEffect } from "react";
import RealmLandscape from "../../components/cityview/RealmLandscape";
import useUIStore from "../../hooks/store/useUIStore";

export const RealmCityViewScene = () => {
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  useEffect(() => {
    setIsLoadingScreenEnabled(false);
  }, []);
  return (
    <>
      <RealmLandscape />
    </>
  );
};
