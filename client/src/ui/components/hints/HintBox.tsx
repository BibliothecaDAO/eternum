import { useDojo } from "@/hooks/context/DojoContext";
import { useQuests } from "@/hooks/helpers/useQuests";
import Button from "@/ui/elements/Button";
import { Check, ShieldQuestion } from "lucide-react";
import { useState, useEffect } from "react";

interface Quest {
  name: string;
  description: string;
  steps: Step[];
  completed?: boolean;
  claimed?: boolean;
  prizes: Prize[];
}

interface Step {
  description: string;
  completed: boolean;
}

interface Prize {
  id: number;
  title: string;
}

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

  const handleClaimResources = async (config_id: string) => {
    setIsLoading(true);
    try {
      await mint_starting_resources({
        signer: account,
        config_id: config_id,
        realm_entity_id: entityId || "0",
      });
    } catch (error) {
      console.error("Failed to claim resources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAllClaims = async () => {
    setIsLoading(true);
    try {
      for (const prize of quest.prizes) {
        try {
          await mint_starting_resources({
            signer: account,
            config_id: prize.id.toString(),
            realm_entity_id: entityId || "0",
          });
        } catch (error) {
          console.error(`Failed to claim resources for prize ${prize.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to claim resources:", error);
      setIsLoading(false);
    }
  };

  return !quest.claimed ? (
    <div className={` p-4  text-gold clip-angled-sm  ${quest.completed ? "bg-green/5" : " bg-green/40 "}`}>
      <div className="flex justify-between">
        <h5 className="mb-3 font-bold">{quest.name}</h5>
        {quest.completed ? <Check /> : <ShieldQuestion />}
      </div>

      <p className="text-xl mb-4">{quest.description}</p>

      {quest.steps &&
        quest.steps.map(({ description, completed }, index) => (
          <div className="flex">
            <div key={index} className="text-md mb-4 mr-4">
              - {description}
            </div>
            {completed ? <Check /> : <ShieldQuestion />}
          </div>
        ))}

      <div className="mt-1 grid grid-cols-3 gap-2">
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
  const { currentQuest } = useQuests({ entityId: entityId || BigInt("0") });

  return (
    <div className="p-3 flex flex-col gap-2">
      {currentQuest ? <HintBox quest={currentQuest} entityId={entityId || BigInt("0")} /> : <EndGameInfo />}
    </div>
  );
};
