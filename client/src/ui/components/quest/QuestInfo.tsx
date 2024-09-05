import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import Button from "@/ui/elements/Button";
import { useState } from "react";
import { Check, ShieldQuestion } from "lucide-react";
import { multiplyByPrecision } from "@/ui/utils/utils";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { Prize, Quest, QuestStatus } from "@/hooks/helpers/useQuests";
import { ID } from "@bibliothecadao/eternum";

export const QuestInfo = ({ quest, entityId }: { quest: Quest; entityId: ID }) => {
  const {
    setup: {
      systemCalls: { mint_resources_and_claim_quest },
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
      await mint_resources_and_claim_quest({
        signer: account,
        config_ids: quest.prizes.map((prize) => BigInt(prize.id)),
        receiver_id: entityId,
        resources: resourcesToMint,
      });
    } catch (error) {
      console.error(`Failed to claim resources for quest ${quest.name}:`, error);
    }
  };

  return (
    <>
      <Button className={"w-6"} size={"xs"} variant={"default"} onClick={() => setSelectedQuest(null)}>
        Back
      </Button>

      <div
        className={` p-4  text-gold   ${
          quest.status === QuestStatus.Completed || quest.status === QuestStatus.Claimed
            ? "bg-green/5"
            : " bg-green/30 "
        }`}
      >
        <div className="flex justify-between">
          <h5 className="mb-3 font-bold">{quest.name}</h5>
          {quest.status !== QuestStatus.InProgress ? <Check /> : <ShieldQuestion />}
        </div>

        <p className="text-xl mb-4">{quest.description}</p>

        {quest.steps?.map((step: any, index: any) => (
          <div className="flex" key={index}>
            <div className="text-md mb-4 mr-4">- {step}</div>
          </div>
        ))}

        <QuestRewards prizes={quest?.prizes} />

        <div className="my-2 grid grid-cols-3 gap-2">
          {quest.status !== QuestStatus.Claimed ? (
            quest.status === QuestStatus.Completed && (
              <Button isLoading={isLoading} variant="primary" onClick={handleAllClaims}>
                Claim Rewards
              </Button>
            )
          ) : (
            <div className="w-full text-brilliance">Rewards claimed</div>
          )}
        </div>
      </div>
    </>
  );
};

const QuestRewards = ({ prizes }: { prizes: Prize[] }) => {
  const [showRewards, setShowRewards] = useState(false);
  const { getQuestResources } = useRealm();

  return (
    <div className="w-full">
      <div className="flex flex-row items-baseline mb-1 ">
        <div className="font-bold mr-5">Quest Rewards</div>
        <Button size="xs" onClick={() => setShowRewards(!showRewards)}>
          {showRewards ? "Hide" : "Show"}
        </Button>
      </div>
      {showRewards &&
        prizes &&
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
