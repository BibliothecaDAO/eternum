import { useDojo } from "@/hooks/context/DojoContext";
import { Quest, QuestStatus } from "@/hooks/helpers/useQuests";
import { useRealm } from "@/hooks/helpers/useRealm";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { ID } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import { useShepherd } from "react-shepherd";
import { StepOptions } from "shepherd.js";
import { QuestId } from "./questDetails";
import { buildFoodSteps } from "./steps/buildFoodSteps";
import { buildResourceSteps } from "./steps/buildResourceSteps";
import { buildWorkersHutSteps } from "./steps/buildWorkersHutSteps";
import { createAttackArmySteps } from "./steps/createAttackArmy";
import { createDefenseArmySteps } from "./steps/createDefenseArmySteps";
import { createTradeSteps } from "./steps/createTradeSteps";
import { marketSteps } from "./steps/marketSteps";
import { pauseProductionSteps } from "./steps/pauseProductionSteps";
import { settleSteps } from "./steps/settleSteps";
import { travelSteps } from "./steps/travelSteps";
import { areAllQuestsClaimed, groupQuestsByDepth } from "./utils";

export const questSteps = new Map<QuestId, StepOptions[]>([
  [QuestId.Settle, settleSteps],
  [QuestId.BuildFood, buildFoodSteps],
  [QuestId.BuildResource, buildResourceSteps],
  [QuestId.PauseProduction, pauseProductionSteps],
  [QuestId.CreateTrade, createTradeSteps],
  [QuestId.CreateDefenseArmy, createDefenseArmySteps],
  [QuestId.CreateAttackArmy, createAttackArmySteps],
  [QuestId.Travel, travelSteps],
  [QuestId.BuildWorkersHut, buildWorkersHutSteps],
  [QuestId.Market, marketSteps],
  // [QuestId.Pillage, pillageSteps],
  // [QuestId.Mine, mineSteps],
  // [QuestId.Contribution, contributionSteps],
  // [QuestId.Hyperstructure, hyperstructureSteps],
]);

export const QuestList = ({ quests, entityId }: { quests: Quest[]; entityId: ID | undefined }) => {
  const {
    setup: {
      systemCalls: { claim_quest },
    },
    account: { account },
  } = useDojo();

  const showCompletedQuests = useQuestStore((state) => state.showCompletedQuests);
  const setShowCompletedQuests = useQuestStore((state) => state.setShowCompletedQuests);

  const [skipTutorial, setSkipTutorial] = useState(false);
  const [maxDepthToShow, setMaxDepthToShow] = useState(0);

  const groupedQuests = useMemo(() => groupQuestsByDepth(quests), [quests]);
  const unclaimedQuests = quests?.filter((quest) => quest.status !== QuestStatus.Claimed);

  useEffect(() => {
    const newMaxDepth = Object.keys(groupedQuests)
      .map(Number)
      .reduce((max, depth) => {
        if (areAllQuestsClaimed(groupedQuests[depth]) && depth + 1 > max) {
          return depth + 1;
        }
        return max;
      }, 0);
    setMaxDepthToShow(newMaxDepth);
  }, [quests, groupedQuests]);

  const handleAllClaims = async (
    quest: Quest,
    setIsLoading: (isLoading: boolean) => void,
    setSkipQuest: (skipQuest: boolean) => void,
  ) => {
    setIsLoading(true);
    try {
      await claim_quest({
        signer: account,
        quest_ids: quest.prizes.map((prize) => BigInt(prize.id)),
        receiver_id: entityId || 0,
      });
    } catch (error) {
      console.error(`Failed to claim resources for quest ${quest.name}:`, error);
    } finally {
      setIsLoading(false);
      setSkipQuest(false);
    }
  };

  return (
    <>
      <div className="flex justify-around m-2">
        <Button className={"w-1/4"} variant="outline" onClick={() => setShowCompletedQuests(!showCompletedQuests)}>
          {showCompletedQuests ? "Hide Completed" : "Show Completed"}
        </Button>

        <Button
          disabled={!Boolean(unclaimedQuests?.length)}
          className={"w-1/4"}
          variant="primary"
          onClick={() => setSkipTutorial(!skipTutorial)}
        >
          Skip Tutorial
        </Button>
      </div>

      {skipTutorial && unclaimedQuests?.length && (
        <SkipTutorial entityId={entityId!} setSkipTutorial={setSkipTutorial} unclaimedQuests={unclaimedQuests} />
      )}

      <div className="p-4 grid grid-cols-1  gap-4">
        {Object.entries(groupedQuests)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([depth, depthQuests]) => {
            if (Number(depth) > maxDepthToShow) return null;
            const shownQuests = depthQuests.filter(
              (quest) => quest.status !== QuestStatus.Claimed || showCompletedQuests,
            );
            if (shownQuests.length === 0) return null;
            return <QuestDepthGroup key={depth} depthQuests={shownQuests} handleAllClaims={handleAllClaims} />;
          })}
      </div>
    </>
  );
};

const QuestDepthGroup = ({
  depthQuests,
  handleAllClaims,
}: {
  depthQuests: Quest[];
  handleAllClaims: (
    quest: Quest,
    setIsLoading: (isLoading: boolean) => void,
    setSkipQuest: (skipQuest: boolean) => void,
  ) => void;
}) => (
  <>
    {depthQuests
      ?.slice()
      .reverse()
      .map((quest: Quest) => <QuestCard quest={quest} key={quest.name} handleAllClaims={handleAllClaims} />)}
  </>
);

const QuestCard = ({
  quest,
  handleAllClaims,
}: {
  quest: Quest;
  handleAllClaims: (
    quest: Quest,
    setIsLoading: (isLoading: boolean) => void,
    setSkipQuest: (skipQuest: boolean) => void,
  ) => void;
}) => {
  const { getQuestResources } = useRealm();

  const [skipQuest, setSkipQuest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isClaimed = quest.status === QuestStatus.Claimed;
  const isInProgress = quest.status === QuestStatus.InProgress;

  return (
    <div
      className={`w-full border px-4 py-2 rounded-xl  ${
        [QuestStatus.Completed, QuestStatus.Claimed].includes(quest.status) ? "border-green/40 bg-green/20" : ""
      }`}
    >
      <Headline className="mb-4 text-xl">{quest.name}</Headline>

      {quest.prizes &&
        quest.prizes.map((prize, index) => (
          <div key={index} className="grid grid-cols-3 gap-3">
            {getQuestResources()[prize.id].map((resource, i) => (
              <div key={i} className="grid gap-3">
                <ResourceCost resourceId={resource.resource} amount={resource.amount} />
              </div>
            ))}
          </div>
        ))}

      <div className="grid grid-cols-5 my-4">
        <div className="col-span-2 flex gap-4">
          <TutorialButton isPulsing={!isClaimed} steps={questSteps.get(quest.id)} />
          <Button
            className={quest.id === QuestId.Settle && !isClaimed ? "claim-selector" : ""}
            isLoading={isLoading && !skipQuest}
            disabled={isClaimed || isInProgress}
            variant="primary"
            onClick={() => {
              setSkipQuest(false);
              handleAllClaims(quest, setIsLoading, setSkipQuest);
            }}
          >
            {isClaimed ? "Claimed" : "Claim"}
          </Button>
        </div>

        <div className="col-start-4 col-span-2 grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={() => setSkipQuest(!skipQuest)}>
            {skipQuest ? "Sure ?" : " Skip quest"}
          </Button>
          {skipQuest && (
            <Button
              isLoading={isLoading && skipQuest}
              variant="red"
              onClick={() => {
                handleAllClaims(quest, setIsLoading, setSkipQuest);
              }}
            >
              Confirm
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const SkipTutorial = ({
  entityId,
  setSkipTutorial,
  unclaimedQuests,
}: {
  entityId: ID;
  setSkipTutorial: (skip: boolean) => void;
  unclaimedQuests: Quest[];
}) => {
  const {
    setup: {
      systemCalls: { claim_quest },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const claimAllQuests = async () => {
    if (unclaimedQuests) {
      setIsLoading(true);
      try {
        await claim_quest({
          signer: account,
          quest_ids: unclaimedQuests.flatMap((quest) => quest.prizes.map((prize) => BigInt(prize.id))),
          receiver_id: entityId,
        });
      } catch (error) {
        console.error(`Failed to claim resources for quests:`, error);
      } finally {
        setIsLoading(false);
        setSkipTutorial(false);
      }
    }
  };

  return (
    <div className="flex justify-center items-baseline">
      <p className="mr-2">Are you sure ?</p>
      <Button variant={"primary"} isLoading={isLoading} onClick={claimAllQuests}>
        Confirm
      </Button>
    </div>
  );
};

const TutorialButton = ({ isPulsing, steps }: { isPulsing: boolean; steps: StepOptions[] | undefined }) => {
  const shepherd = useShepherd();
  const tour = new shepherd.Tour({
    useModalOverlay: true,
    exitOnEsc: true,
    keyboardNavigation: false,
    defaultStepOptions: {
      modalOverlayOpeningPadding: 5,
      arrow: true,
      cancelIcon: { enabled: true },
    },
    steps,
  });

  const handleStart = () => {
    if (!tour) return;
    tour.start();
  };

  return (
    <Button isPulsing={isPulsing} variant="primary" onClick={() => handleStart()}>
      Tutorial
    </Button>
  );
};
