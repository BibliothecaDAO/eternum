import { ReactComponent as Settings } from "@/assets/icons/common/settings.svg";
import { ReactComponent as Close } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as Expand } from "@/assets/icons/common/expand.svg";
import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import {
  banks,
  entityDetails,
  eventLog,
  hyperstructures,
  leaderboard,
  military,
  resources,
  settings,
  trade,
  construction,
  assistant,
} from "../../components/navigation/Config";
import useUIStore from "../../../hooks/store/useUIStore";
import { useMemo, useState } from "react";
import CircleButton from "../../elements/CircleButton";
import { SettingsWindow } from "../settings/Settings";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { ArrowRight } from "lucide-react";
import { Banks } from "../banking/Banks";
import { Leaderboard } from "../leaderboard/LeaderBoard";
import { HyperStructures } from "../hyperstructures/Hyperstructures";
import { Resources } from "@/ui/modules/resources/Resources";
import { Military } from "@/ui/modules/military/Military";
import { EntityDetails } from "@/ui/modules/entity-details/EntityDetails";
import { Trading } from "../trade/Trading";
import { Construction } from "../construction/Construction";
import { Assistant } from "../assistant/Assistant";
import { useTour } from "@reactour/tour";
import { Questing } from "../questing/Questing";
import { MenuEnum } from "./BottomNavigation";
import { useLocation } from "wouter";
import { BaseContainer } from "@/ui/containers/BaseContainer";
import Button from "@/ui/elements/Button";
import { SelectPreviewBuildingMenu } from "@/ui/components/construction/SelectPreviewBuilding";

export const BuildingThumbs = {
  hex: "/images/buildings/thumb/question.png",
  military: "/images/buildings/thumb/sword.png",
  construction: "/images/buildings/thumb/crane.png",
  trade: "/images/buildings/thumb/trade.png",
  resources: "/images/buildings/thumb/resources.png",
  banks: "/images/buildings/thumb/banks.png",
  hyperstructures: "/images/buildings/thumb/hyperstructure.png",
  leaderboard: "/images/buildings/thumb/leaderboard.png",
  worldMap: "/images/buildings/thumb/world-map.png",
  squire: "/images/buildings/thumb/squire.png",
  question: "/images/buildings/thumb/question-wood.png",
  scale: "/images/buildings/thumb/scale.png",
  settings: "/images/buildings/thumb/settings.png",
};

enum View {
  MilitaryView,
  EntityView,
  ConstructionView,
}

export const LeftNavigationModule = () => {
  const [isOffscreen, setIsOffscreen] = useState(false);
  const [view, setView] = useState<View>(View.ConstructionView);

  const { realmEntityId } = useRealmStore();
  const { setIsOpen } = useTour();
  const [location, setLocation] = useLocation();
  const navigation = useMemo(() => {
    const navigation = [
      {
        name: "entity",
        button: (
          <CircleButton
            className="construction-selector"
            image={BuildingThumbs.hex}
            tooltipLocation="top"
            label={construction}
            active={view === View.EntityView}
            size="xl"
            onClick={() => {
              setIsOffscreen(false);
              setView(View.EntityView);
            }}
          />
        ),
      },
      {
        name: "military",
        button: (
          <CircleButton
            className="military-selector"
            image={BuildingThumbs.military}
            tooltipLocation="top"
            label={military}
            active={view === View.MilitaryView}
            size="xl"
            onClick={() => {
              setIsOffscreen(false);
              setView(View.MilitaryView);
            }}
          />
        ),
      },
      {
        name: "construction",
        button: (
          <CircleButton
            className="construction-selector"
            image={BuildingThumbs.construction}
            tooltipLocation="top"
            label={construction}
            active={view === View.ConstructionView}
            size="xl"
            onClick={() => {
              setIsOffscreen(false);
              setView(View.ConstructionView);
            }}
          />
        ),
      },
    ];

    return location === "/map"
      ? navigation.filter(
          (item) =>
            item.name !== MenuEnum.construction &&
            item.name !== MenuEnum.resources &&
            item.name !== MenuEnum.worldMap &&
            item.name !== MenuEnum.trade,
        )
      : navigation;
  }, [location, view]);

  if (realmEntityId === undefined) {
    return null;
  }

  return (
    <>
      <div className="pointer-events-auto">
        <SettingsWindow />
        <Questing entityId={realmEntityId} />
        <Assistant />
        <Leaderboard />
        <Banks />
      </div>

      <div
        className={`max-h-full transition-all duration-200 space-x-1 gap-1  flex z-0 w-[600px] text-gold left-4 self-center pointer-events-auto ${
          isOffscreen ? "-translate-x-[88%] " : ""
        }`}
      >
        <BaseContainer className="w-full h-[60vh] overflow-y-scroll">
          {view === View.EntityView && <EntityDetails />}
          {view === View.MilitaryView && <Military entityId={realmEntityId} />}
          {view === View.ConstructionView && <SelectPreviewBuildingMenu />}
        </BaseContainer>
        <div className="gap-2 flex flex-col justify-center self-center">
          <div>
            <Button onClick={() => setIsOffscreen(!isOffscreen)} variant="primary">
              <ArrowRight className={`w-4 h-4 duration-200 ${isOffscreen ? "rotate-180" : ""}`} />
            </Button>
          </div>
          <div className="flex flex-col gap-2 mb-auto">
            <div className="flex flex-col space-y-2 py-2 sixth-step">
              {navigation.map((a, index) => (
                <div key={index}>{a.button}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
