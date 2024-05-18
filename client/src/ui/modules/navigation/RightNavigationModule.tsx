import { useState } from "react";
import { BaseContainer } from "../../containers/BaseContainer";
import { HexagonInformationPanel } from "../../components/worldmap/hexagon/HexagonInformationPanel";

import CircleButton from "@/ui/elements/CircleButton";
import Button from "@/ui/elements/Button";
import { EntityResourceTable } from "@/ui/components/resources/EntityResourceTable";
import useRealmStore from "@/hooks/store/useRealmStore";
import { BuildingThumbs } from "./LeftNavigationModule";

export const RightNavigationModule = () => {
  const [isOffscreen, setIsOffscreen] = useState(false);

  const toggleOffscreen = () => {
    setIsOffscreen(!isOffscreen);
  };

  const { realmEntityId } = useRealmStore();

  return (
    <div
      className={`max-h-full transition-all duration-200 space-x-1  flex z-0 w-[400px] text-gold right-4 ${
        isOffscreen ? "translate-x-[83%]" : ""
      }`}
    >
      <div>
        <CircleButton
          image={BuildingThumbs.resources}
          className="bg-brown"
          size="xl"
          onClick={() => setIsOffscreen(!isOffscreen)}
        ></CircleButton>
      </div>

      <BaseContainer className="w-full">
        <EntityResourceTable entityId={realmEntityId} />
      </BaseContainer>
    </div>
  );
};
