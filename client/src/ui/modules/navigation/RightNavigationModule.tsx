import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { QuestStatus, useQuestClaimStatus } from "@/hooks/helpers/useQuests";
import { useModalStore } from "@/hooks/store/useModalStore";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import useUIStore from "@/hooks/store/useUIStore";
import { HintSection } from "@/ui/components/hints/HintModal";
import { trade } from "@/ui/components/navigation/Config";
import { QuestId } from "@/ui/components/quest/questDetails";
import { EntityResourceTable } from "@/ui/components/resources/EntityResourceTable";
import { MarketModal } from "@/ui/components/trading/MarketModal";
import { AllResourceArrivals } from "@/ui/components/trading/ResourceArrivals";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { quests as questsPopup } from "../../components/navigation/Config";
import { BaseContainer } from "../../containers/BaseContainer";

export enum View {
  None,
  ResourceTable,
  ResourceArrivals,
}

export const RightNavigationModule = () => {
  const [lastView, setLastView] = useState<View>(View.ResourceTable);

  const view = useUIStore((state) => state.rightNavigationView);
  const setView = useUIStore((state) => state.setRightNavigationView);

  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const openedPopups = useUIStore((state) => state.openedPopups);

  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const { questClaimStatus } = useQuestClaimStatus();

  const { getEntityInfo } = getEntitiesUtils();
  const structureInfo = getEntityInfo(structureEntityId);
  const structureIsMine = structureInfo.isMine;

  const { toggleModal } = useModalStore();

  const [notificationLength, setNotificationLength] = useState(0);

  const isRealm = Boolean(structureInfo) && String(structureInfo?.structureCategory) === "Realm";

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
              if (view === View.ResourceTable) {
                setView(View.None);
              } else {
                setLastView(View.ResourceTable);
                setView(View.ResourceTable);
              }
            }}
          />
        ),
      },
      {
        name: "resourceArrivals",
        button: (
          <CircleButton
            disabled={!structureIsMine}
            className={clsx({ hidden: !questClaimStatus[QuestId.CreateTrade] && isRealm })}
            image={BuildingThumbs.trade}
            tooltipLocation="top"
            label={"Resource Arrivals"}
            active={view === View.ResourceArrivals}
            size="xl"
            onClick={() => {
              if (view === View.ResourceArrivals) {
                setView(View.None);
              } else {
                setLastView(View.ResourceArrivals);
                setView(View.ResourceArrivals);
              }
            }}
            notification={notificationLength}
            notificationLocation="topleft"
          />
        ),
      },
      {
        name: "trade",
        button: (
          <CircleButton
            disabled={!structureIsMine}
            className={clsx({
              "animate-pulse":
                selectedQuest?.id === QuestId.CreateTrade &&
                selectedQuest.status !== QuestStatus.Completed &&
                isPopupOpen(questsPopup),
              hidden: !questClaimStatus[QuestId.BuildResource] && isRealm,
            })}
            image={BuildingThumbs.scale}
            tooltipLocation="top"
            label={trade}
            active={isPopupOpen(trade)}
            size="xl"
            onClick={() => {
              if (isPopupOpen(trade)) {
                toggleModal(null);
              } else {
                toggleModal(<MarketModal />);
              }
            }}
          />
        ),
      },
    ];
  }, [location, view, questClaimStatus, notificationLength, openedPopups, selectedQuest, structureEntityId]);

  const slideRight = {
    hidden: { x: "100%" },
    visible: { x: "0%", transition: { duration: 0.5 } },
  };

  return (
    <>
      <div
        className={`max-h-full transition-all z-0 duration-200 space-x-1 flex w-[400px] right-4 self-center pointer-events-none ${
          isOffscreen(view) ? "translate-x-[83%]" : ""
        }`}
      >
        <motion.div
          variants={slideRight}
          initial="hidden"
          animate="visible"
          className="gap-2 flex flex-col justify-center self-center pointer-events-auto"
        >
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
            <div className="p-2 flex flex-col space-y-1 overflow-y-auto">
              <Headline>
                <div className="flex gap-2">
                  <div className="self-center">Resources</div>
                  <HintModalButton section={HintSection.Resources} />
                </div>
              </Headline>

              <EntityResourceTable entityId={structureEntityId} />
            </div>
          ) : (
            <AllResourceArrivals setNotificationLength={setNotificationLength} />
          )}
        </BaseContainer>
      </div>
    </>
  );
};

const isOffscreen = (view: View) => {
  return view === View.None;
};
