import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import { Quest, useQuestStore, Prize } from "@/hooks/store/useQuestStore";
import Button from "@/ui/elements/Button";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { multiplyByPrecision } from "@/ui/utils/utils";
import { Check, ShieldQuestion } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const HintBox = ({ quest, entityId }: { quest: Quest; entityId: bigint }) => {
  const {
    setup: {
      systemCalls: { mint_resources, mint_starting_resources },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const setSelectedQuest = useQuestStore((state) => state.setSelectedQuest);

  const { getQuestResources } = useRealm();

  const handleAllClaims = async () => {
    const questResources = getQuestResources();
    const resourcesToMint = quest.prizes.flatMap((prize) => {
      const resources = questResources[prize.id];
      return resources.flatMap((resource) => [resource.resource as number, multiplyByPrecision(resource.amount)]);
    });

    setIsLoading(true);
    try {
      await mint_starting_resources({
        signer: account,
        config_ids: quest.prizes.map((prize) => BigInt(prize.id)),
        realm_entity_id: entityId || BigInt(0),
      });
      await mint_resources({
        signer: account,
        receiver_id: entityId || BigInt(0),
        resources: resourcesToMint,
      });
    } catch (error) {
      console.error(`Failed to claim resources for quest ${quest.name}:`, error);
    }
  };

  return (
    <>
      <Button className={"w-6"} size={"xs"} variant={"default"} onClick={() => setSelectedQuest(undefined)}>
        Back
      </Button>

      <div className={` p-4  text-gold clip-angled-sm  ${quest.completed ? "bg-green/5" : " bg-green/30 "}`}>
        <div className="flex justify-between">
          <h5 className="mb-3 font-bold">{quest.name}</h5>
          {quest.completed ? <Check /> : <ShieldQuestion />}
        </div>

        <p className="text-xl mb-4">{quest.description}</p>

        {quest.steps?.map(({ description, completed }, index) => (
          <div className="flex" key={index}>
            <div className="text-md mb-4 mr-4">- {description}</div>
            {completed ? <Check /> : <ShieldQuestion />}
          </div>
        ))}

        <QuestRewards prizes={quest?.prizes} />

        <div className="my-2 grid grid-cols-3 gap-2">
          {quest.completed &&
            (quest.claimed ? (
              <div className="w-full text-brilliance">Rewards claimed</div>
            ) : (
              <Button isLoading={isLoading} variant="primary" onClick={handleAllClaims}>
                Claim Rewards
              </Button>
            ))}
        </div>
      </div>
    </>
  );
};

const QuestRewards = ({ prizes }: { prizes: Prize[] }) => {
  const { getQuestResources } = useRealm();

  return (
    <div className="w-full">
      <div className="mb-1 font-bold">Quest Rewards</div>
      {prizes &&
        prizes.map((prize, index) => (
          <div key={index} className="grid grid-cols-3 gap-3">
            {getQuestResources()[prize.id].map((resource, i) => (
              <div key={i} className="grid gap-3">
                <ResourceCost resourceId={resource.resource} amount={resource.amount} />
              </div>
            ))}
          </div>
        ))}
    </div>
  );
};

export const QuestList = ({ entityId }: { entityId: bigint | undefined }) => {
  const { quests, selectedQuest } = useQuestStore((state) => ({
    quests: state.quests,
    selectedQuest: state.selectedQuest,
  }));

  return selectedQuest ? (
    <SelectedQuestView selectedQuest={selectedQuest} entityId={entityId} />
  ) : (
    <QuestsDisplay quests={quests!} />
  );
};

const SelectedQuestView = ({ selectedQuest, entityId }: { selectedQuest: Quest; entityId: bigint | undefined }) => (
  <div className="p-3 flex flex-col gap-2">
    <HintBox quest={selectedQuest} entityId={entityId || BigInt(0)} />
  </div>
);

const groupQuestsByDepth = (quests: Quest[]): Record<number, Quest[]> => {
  return quests?.reduce((groupedQuests: Record<number, Quest[]>, quest) => {
    const depth = quest.depth;
    if (!groupedQuests[depth]) {
      groupedQuests[depth] = [];
    }
    groupedQuests[depth].push(quest);
    return groupedQuests;
  }, {});
};

const QuestsDisplay = ({ quests }: { quests: Quest[] }) => {
  const groupedQuests = useMemo(() => groupQuestsByDepth(quests), [quests]);
  const [maxDepthToShow, setMaxDepthToShow] = useState(1);

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
    <div className="flex flex-col gap-1 p-4">
      {Object.entries(groupedQuests)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([depth, depthQuests]) => {
          if (Number(depth) > maxDepthToShow) return null;
          const uncompletedQuests = depthQuests;
          if (uncompletedQuests.length === 0) return null;
          return <QuestDepthGroup key={depth} depthQuests={uncompletedQuests} />;
        })}
    </div>
  );
};

const QuestDepthGroup = ({ depthQuests }: { depthQuests: Quest[] }) => (
  <div className="flex flex-col items-start">
    <div className="flex flex-wrap gap-1">
      {depthQuests?.map((quest: Quest) => (
        <QuestCard quest={quest} key={quest.name} />
      ))}
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

const areAllQuestsClaimed = (quests: Quest[]) => quests.every((quest) => quest.claimed);
