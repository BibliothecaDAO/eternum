import { BaseContainer } from "../containers/BaseContainer";

import { HexagonInformationPanel } from "../components/worldmap/hexagon/HexagonInformationPanel";

export const RightNavigationModule = () => {
  return (
    <BaseContainer className="max-h-full w-[400px] text-gold right-2">
      <HexagonInformationPanel />
    </BaseContainer>
  );
};
