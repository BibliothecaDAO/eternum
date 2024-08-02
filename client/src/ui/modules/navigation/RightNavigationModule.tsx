import { useModalStore } from "@/hooks/store/useModalStore";
import useRealmStore from "@/hooks/store/useRealmStore";
import useUIStore from "@/hooks/store/useUIStore";
import { trade } from "@/ui/components/navigation/Config";
import { EntityResourceTable } from "@/ui/components/resources/EntityResourceTable";
import { MarketModal } from "@/ui/components/trading/MarketModal";
import { AllResourceArrivals } from "@/ui/components/trading/ResourceArrivals";
import Button from "@/ui/elements/Button";
import CircleButton from "@/ui/elements/CircleButton";
import { useMemo, useState } from "react";
import { BaseContainer } from "../../containers/BaseContainer";

import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { QuestStatus, useQuestClaimStatus } from "@/hooks/helpers/useQuests";
import { useArrivalsWithResources } from "@/hooks/helpers/useResources";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import { HintSection } from "@/ui/components/hints/HintModal";
import { QuestId } from "@/ui/components/quest/questDetails";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { quests as questsPopup } from "../../components/navigation/Config";
import { BuildingThumbs } from "./LeftNavigationModule";

export enum View {
  None,
  ResourceTable,
  ResourceArrivals,
}

export const RightNavigationModule = () => {
  const [lastView, setLastView] = useState<View>(View.None);

  const view = useUIStore((state) => state.rightNavigationView);
  const setView = useUIStore((state) => state.setRightNavigationView);

  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const openedPopups = useUIStore((state) => state.openedPopups);

  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const { realmEntityId } = useRealmStore();
  const { questClaimStatus } = useQuestClaimStatus();

  const { getEntityInfo } = getEntitiesUtils();
  const realmIsMine = getEntityInfo(realmEntityId).isMine;

  const { getAllArrivalsWithResources } = useArrivalsWithResources();

  const { toggleModal } = useModalStore();

  const navigation = useMemo(() => {
    return [
      {
        name: "resourceTable",
        button: (
          <CircleButton
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
            disabled={!realmIsMine}
            className={clsx({ hidden: !questClaimStatus[QuestId.CreateTrade] })}
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
            disabled={!realmIsMine}
            className={clsx({
              "animate-pulse":
                selectedQuest?.id === QuestId.CreateTrade &&
                selectedQuest.status !== QuestStatus.Completed &&
                isPopupOpen(questsPopup),
              hidden: !questClaimStatus[QuestId.BuildResource],
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
    ];
  }, [location, view, questClaimStatus, openedPopups, selectedQuest, getAllArrivalsWithResources, realmEntityId]);

  const slideRight = {
    hidden: { x: "100%" },
    visible: { x: "0%", transition: { duration: 0.5 } },
  };

  return (
    <>
      <div
        className={`max-h-full transition-all z-0 duration-200 space-x-1 flex z-0 w-[400px] right-4 self-center pointer-events-none ${
          isOffscreen(view) ? "translate-x-[79%]" : ""
        }`}
      >
        <motion.div
          variants={slideRight}
          initial="hidden"
          animate="visible"
          className="gap-2 flex flex-col justify-center self-center pointer-events-auto"
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

        <BaseContainer
          className={`w-full pointer-events-auto overflow-y-scroll ${isOffscreen(view) ? "h-[20vh]" : "h-[80vh]"}`}
        >
          {view === View.ResourceTable ? (
            <div className="px-2 flex flex-col space-y-1 overflow-y-auto">
              <Headline>
                <div className="flex gap-2">
                  <div className="self-center">Resources</div>
                  <HintModalButton section={HintSection.Resources} />
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
