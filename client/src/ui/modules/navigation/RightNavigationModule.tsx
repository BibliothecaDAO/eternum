import { useMemo, useState } from "react";
import { BaseContainer } from "../../containers/BaseContainer";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResources } from "@/hooks/helpers/useResources";
import { useModal } from "@/hooks/store/useModal";
import useRealmStore from "@/hooks/store/useRealmStore";
import useUIStore from "@/hooks/store/useUIStore";
import { banks, trade } from "@/ui/components/navigation/Config";
import { EntityResourceTable } from "@/ui/components/resources/EntityResourceTable";
import { MarketModal } from "@/ui/components/trading/MarketModal";
import { AllResourceArrivals } from "@/ui/components/trading/ResourceArrivals";
import Button from "@/ui/elements/Button";
import CircleButton from "@/ui/elements/CircleButton";

import { motion } from "framer-motion";
import { QuestName, useQuestStore } from "@/hooks/store/useQuestStore";
import clsx from "clsx";
import { quests as questsPopup } from "../../components/navigation/Config";
import { ArrowRight } from "lucide-react";
import { BuildingThumbs } from "./LeftNavigationModule";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { Headline } from "@/ui/elements/Headline";

export enum View {
  None,
  ResourceTable,
  ResourceArrivals,
}

export const RightNavigationModule = () => {
  const [lastView, setLastView] = useState<View>(View.None);

  const view = useUIStore((state) => state.rightNavigationView);
  const setView = useUIStore((state) => state.setRightNavigationView);

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const openedPopups = useUIStore((state) => state.openedPopups);

  const { realmEntityId } = useRealmStore();

  const quests = useQuestStore((state) => state.quests);
  const currentQuest = useQuestStore((state) => state.currentQuest);

  const { getAllArrivalsWithResources } = useResources();

  const { toggleModal } = useModal();

  const navigation = useMemo(() => {
    return [
      {
        name: "resourceTable",
        button: (
          <CircleButton
            className={clsx({
              "animate-pulse":
                currentQuest?.name === QuestName.ClaimFood && !currentQuest.claimed && isPopupOpen(questsPopup),
            })}
            image={BuildingThumbs.resources}
            size="xl"
            tooltipLocation="top"
            label={"Balance"}
            active={view === View.ResourceTable}
            onClick={() => {
              setLastView(View.ResourceTable);
              setView(View.ResourceTable);
            }}
          />
        ),
      },
      {
        name: "resourceArrivals",
        button: (
          <CircleButton
            className={clsx({ hidden: !quests?.find((quest) => quest.name === QuestName.CreateTrade)?.claimed })}
            image={BuildingThumbs.trade}
            tooltipLocation="top"
            label={"Resource Arrivals"}
            // active={isPopupOpen(trade)}
            active={view === View.ResourceArrivals}
            size="xl"
            onClick={() => {
              setLastView(View.ResourceArrivals);
              setView(View.ResourceArrivals);
            }}
            notification={getAllArrivalsWithResources.length}
            notificationLocation="topleft"
          />
        ),
      },
      {
        name: "trade",
        button: (
          <CircleButton
            className={clsx({
              "animate-pulse":
                currentQuest?.name === QuestName.CreateTrade && !currentQuest.completed && isPopupOpen(questsPopup),
              hidden: !quests?.find((quest) => quest.name === QuestName.BuildResource)?.claimed,
            })}
            image={BuildingThumbs.scale}
            tooltipLocation="top"
            label={trade}
            active={isPopupOpen(trade)}
            size="xl"
            onClick={() => {
              toggleModal(<MarketModal />);
            }}
          />
        ),
      },
      {
        name: "bank",
        button: (
          <CircleButton
            className={clsx({
              hidden: !quests?.find((quest) => quest.name === QuestName.CreateArmy)?.claimed,
            })}
            image={BuildingThumbs.banks}
            tooltipLocation="top"
            label={banks}
            active={isPopupOpen(banks)}
            size="xl"
            onClick={() => {
              togglePopup(banks);
            }}
          />
        ),
      },
    ];
  }, [location, view, quests, openedPopups]);

  const slideRight = {
    hidden: { x: "100%" },
    visible: { x: "0%", transition: { duration: 0.5 } },
  };

  return (
    <>
      <div
        className={`max-h-full transition-all duration-200 space-x-1  flex z-0 w-[400px] text-gold right-4 self-center pointer-events-auto ${
          isOffscreen(view) ? "translate-x-[79%]" : ""
        }`}
      >
        <motion.div
          variants={slideRight}
          initial="hidden"
          animate="visible"
          className="gap-2 flex flex-col justify-center self-center"
        >
          <div>
            <Button onClick={() => setView(isOffscreen(view) ? lastView : View.None)} variant="primary">
              <ArrowRight className={`w-4 h-4 duration-200 ${isOffscreen(view) ? "rotate-180" : ""}`} />
            </Button>
          </div>
          <div className="flex flex-col gap-2 mb-auto">
            {navigation.map((a, index) => (
              <div key={index}>{a.button}</div>
            ))}
          </div>
        </motion.div>

        <BaseContainer className={`w-full  overflow-y-scroll py-4 ${isOffscreen(view) ? "h-[20vh]" : "h-[80vh]"}`}>
          {view === View.ResourceTable ? (
            <div className="px-2 flex flex-col space-y-1 overflow-y-auto">
              <Headline>
                <div className="flex gap-2">
                  <div className="self-center">Resources</div>
                  <HintModalButton sectionName="Resources" />
                </div>
              </Headline>

              <EntityResourceTable entityId={realmEntityId} />
            </div>
          ) : (
            <AllResourceArrivals entityIds={getAllArrivalsWithResources} />
          )}
        </BaseContainer>
      </div>
    </>
  );
};

const isOffscreen = (view: View) => {
  return view === View.None;
};
