import { useState } from "react";
import { BaseContainer } from "../../containers/BaseContainer";
import { HexagonInformationPanel } from "../../components/worldmap/hexagon/HexagonInformationPanel";

import CircleButton from "@/elements/CircleButton";

export const RightNavigationModule = () => {
  const [isOffscreen, setIsOffscreen] = useState(false);

  const toggleOffscreen = () => {
    setIsOffscreen(!isOffscreen);
  };

  return (
    <>
      <BaseContainer className={`max-h-full z-0 w-[400px] text-gold right-4 ${isOffscreen ? "translate-x-full" : ""}`}>
        <HexagonInformationPanel />
      </BaseContainer>
    </>
  );
};
