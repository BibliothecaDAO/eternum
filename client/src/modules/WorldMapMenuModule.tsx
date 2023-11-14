import WorldMapMenuComponent from "../components/worldmap/WorldMapMenuComponent";
import { BaseContainer } from "../containers/BaseContainer";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const WorldMapMenuModule = () => {
  const [location] = useLocation();
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (location.includes("/map")) {
      setTimeout(() => {
        setShowMenu(true);
      }, 1000);
    } else {
      setShowMenu(false);
    }
  }, [location]);

  return (
    <BaseContainer className="max-h-full h-min !p-0 mt-2">
      <WorldMapMenuComponent />
    </BaseContainer>
  );
};

export default WorldMapMenuModule;
