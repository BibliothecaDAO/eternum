import { useQuestStore } from "@/hooks/store/useQuestStore";
import { useEffect, useMemo, useState } from "react";
import { areAllQuestsClaimed, groupQuestsByDepth } from "./utils";
import Button from "@/ui/elements/Button";
import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import { multiplyByPrecision } from "@/ui/utils/utils";
import { Prize, Quest, QuestStatus } from "@/hooks/helpers/useQuests";
import { ID } from "@bibliothecadao/eternum";

export const QuestList = ({ quests, entityId }: { quests: Quest[]; entityId: ID | undefined }) => {
  const [showCompletedQuests, setShowCompletedQuests] = useState(false);
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

  return (
    <>
      <div className="flex justify-around m-2">
        <Button
          className={"w-1/4"}
          size={"xs"}
          variant={"outline"}
          onClick={() => setShowCompletedQuests(!showCompletedQuests)}
        >
          {showCompletedQuests ? "Hide Completed" : "Show Completed"}
        </Button>

        {Boolean(unclaimedQuests?.length) && (
          <Button className={"w-1/4"} size={"xs"} variant={"red"} onClick={() => setSkipTutorial(!skipTutorial)}>
            Skip Tutorial
          </Button>
        )}
      </div>

      {skipTutorial && unclaimedQuests?.length && (
        <SkipTutorial entityId={entityId!} setSkipTutorial={setSkipTutorial} unclaimedQuests={unclaimedQuests} />
      )}

      <div className="flex flex-col gap-1 p-4">
        {Object.entries(groupedQuests)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([depth, depthQuests]) => {
            if (Number(depth) > maxDepthToShow) return null;
            const shownQuests = depthQuests.filter(
              (quest) => quest.status !== QuestStatus.Claimed || showCompletedQuests,
            );
            if (shownQuests.length === 0) return null;
            return <QuestDepthGroup key={depth} depthQuests={shownQuests} />;
          })}
      </div>
    </>
  );
};

const QuestDepthGroup = ({ depthQuests }: { depthQuests: Quest[] }) => (
  <div className="flex flex-col items-start">
    <div className="flex flex-wrap gap-1">
      {depthQuests?.map((quest: Quest) => <QuestCard quest={quest} key={quest.name} />)}
    </div>
  </div>
);

const QuestCard = ({ quest }: { quest: Quest }) => {
  const setSelectedQuest = useQuestStore((state) => state.setSelectedQuest);

  return (
    <div
      className={`p-4 border hover:opacity-70 ${quest.status === QuestStatus.Claimed ? "text-green" : "text-gold"}`}
      onClick={() => setSelectedQuest(quest)}
    >
      <div className="text-xl">{quest.name}</div>
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
      systemCalls: { mint_resources_and_claim_quest },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const { getQuestResources } = useRealm();

  const questResources = getQuestResources();

  const resourcesToMint =
    unclaimedQuests?.flatMap((quest: Quest) =>
      quest.prizes.flatMap((prize: Prize) => {
        const resources = questResources[prize.id];
        return resources.flatMap((resource) => [resource.resource as number, multiplyByPrecision(resource.amount)]);
      }),
    ) ?? [];

  const claimAllQuests = async () => {
    if (resourcesToMint && unclaimedQuests) {
      setIsLoading(true);
      try {
        await mint_resources_and_claim_quest({
          signer: account,
          config_ids: unclaimedQuests.flatMap((quest) => quest.prizes.map((prize) => BigInt(prize.id))),
          receiver_id: entityId,
          resources: resourcesToMint,
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
      <Button variant={"primary"} size={"xs"} isLoading={isLoading} onClick={claimAllQuests}>
        Confirm
      </Button>
    </div>
  );
};
