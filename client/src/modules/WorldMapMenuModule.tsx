import WorldMapMenuComponent from "../components/worldmap/WorldMapMenuComponent";
import { BaseContainer } from "../containers/BaseContainer";
const WorldMapMenuModule = () => {
  return (
    <BaseContainer className="max-h-full h-min !p-0 mt-2">
      <WorldMapMenuComponent />
    </BaseContainer>
  );
};

export default WorldMapMenuModule;
