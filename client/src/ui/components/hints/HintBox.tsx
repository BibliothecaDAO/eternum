import { useDojo } from "@/hooks/context/DojoContext";
import { Quest, useQuestStore } from "@/hooks/store/useQuestStore";
import Button from "@/ui/elements/Button";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { QUEST_RESOURCES_SCALED } from "@bibliothecadao/eternum";
import { Check, ShieldQuestion } from "lucide-react";
import { useEffect, useState } from "react";

export const HintBox = ({ quest, entityId }: { quest: Quest; entityId: bigint }) => {
  const {
    setup: {
      systemCalls: { mint_starting_resources },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (quest.completed === false) {
      setIsLoading(false);
    }
  }, [quest]);

  const handleAllClaims = async () => {
    setIsLoading(true);
    try {
      try {
        await mint_starting_resources({
          signer: account,
          config_ids: quest.prizes.map((prize) => BigInt(prize.id)),
          realm_entity_id: entityId || "0",
        });
      } catch (error) {
        console.error(`Failed to claim resources for quest ${quest.name}:`, error);
      }
    } catch (error) {
      console.error("Failed to claim resources:", error);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  return !quest.claimed ? (
    <div className={` p-4  text-gold clip-angled-sm  ${quest.completed ? "bg-green/5" : " bg-green/30 "}`}>
      <div className="flex justify-between">
        <h5 className="mb-3 font-bold">{quest.name}</h5>
        {quest.completed ? <Check /> : <ShieldQuestion />}
      </div>

      <p className="text-xl mb-4">{quest.description}</p>

      {quest.steps &&
        quest.steps.map(({ description, completed }, index) => (
          <div className="flex" key={index}>
            <div className="text-md mb-4 mr-4">- {description}</div>
            {completed ? <Check /> : <ShieldQuestion />}
          </div>
        ))}

      <div className="w-full">
        <div className="mb-1 font-bold">Quest Rewards</div>
        {quest.prizes.map((a, index) => (
          <div key={index} className="grid grid-cols-3 gap-3">
            {QUEST_RESOURCES_SCALED[a.id].map((b, i) => (
              <div key={i} className="grid gap-3">
                {" "}
                <ResourceCost resourceId={b.resource} amount={b.amount} />{" "}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="my-2 grid grid-cols-3 gap-2">
        {quest.completed && (
          <Button isLoading={isLoading} variant="primary" onClick={() => handleAllClaims()}>
            {"Claim Rewards"}
          </Button>
        )}
      </div>
    </div>
  ) : (
    ""
  );
};

const EndGameInfo = () => {
  return (
    <div className="flex flex-col p-4  text-gold clip-angled-sm bg-green/40">
      <div>Next steps:</div>
      <div>- Trade resources with neighbouring realms</div>
      <div>- Explore the world with your armies</div>
      <div>- Discover earthenshard mines or claim them from your enemies</div>
      <div>- Build or contribute to Hyperstructures to get ranked on the leaderboard</div>
    </div>
  );
};

export const QuestList = ({ entityId }: { entityId: bigint | undefined }) => {
  const currentQuest = useQuestStore((state) => state.currentQuest);

  return (
    <div className="p-3 flex flex-col gap-2">
      {currentQuest ? <HintBox quest={currentQuest} entityId={entityId || BigInt("0")} /> : <EndGameInfo />}
    </div>
  );
};
