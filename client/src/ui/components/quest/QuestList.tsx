import { Prize, Quest, useQuestStore } from "@/hooks/store/useQuestStore";
import { useEffect, useMemo, useState } from "react";
import { areAllQuestsClaimed, groupQuestsByDepth } from "./utils";
import Button from "@/ui/elements/Button";
import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import { multiplyByPrecision } from "@/ui/utils/utils";

export const QuestList = ({ quests, entityId }: { quests: Quest[]; entityId: bigint | undefined }) => {
  const showCompletedQuests = useQuestStore((state) => state.showCompletedQuests);
  const setShowCompletedQuests = useQuestStore((state) => state.setShowCompletedQuests);
  const [skipTutorial, setSkipTutorial] = useState(false);
  const [maxDepthToShow, setMaxDepthToShow] = useState(1);

  const groupedQuests = useMemo(() => groupQuestsByDepth(quests), [quests]);

  useEffect(() => {
    const newMaxDepth = Object.keys(groupedQuests)
      .map(Number)
      .reduce((max, depth) => {
        if (areAllQuestsClaimed(groupedQuests[depth]) && depth + 1 > max) {
          return depth + 1;
        }
        return max;
        // need to start from depth 1
      }, 1);
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

        <Button className={"w-1/4"} size={"xs"} variant={"red"} onClick={() => setSkipTutorial(!skipTutorial)}>
          Skip Tutorial
        </Button>
      </div>

      {skipTutorial && <SkipTutorial entityId={entityId!} />}

      <div className="flex flex-col gap-1 p-4">
        {Object.entries(groupedQuests)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([depth, depthQuests]) => {
            if (Number(depth) > maxDepthToShow) return null;
            const uncompletedQuests = depthQuests.filter((quest) => !quest.claimed || showCompletedQuests);
            if (uncompletedQuests.length === 0) return null;
            return <QuestDepthGroup key={depth} depthQuests={uncompletedQuests} />;
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
      className={`p-4 border hover:opacity-70 ${quest.claimed ? "text-green" : "text-gold"}`}
      onClick={() => setSelectedQuest(quest)}
    >
      <div className="text-xl">{quest.name}</div>
    </div>
  );
};

const SkipTutorial = ({ entityId }: { entityId: bigint }) => {
  const {
    setup: {
      systemCalls: { mint_resources_and_claim_quest },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const quests = useQuestStore((state) => state.quests);
  const { getQuestResources } = useRealm();

  const questResources = getQuestResources();

  const unclaimedQuests = quests?.filter((quest) => !quest.claimed);

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
