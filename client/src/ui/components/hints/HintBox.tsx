import { useDojo } from "@/hooks/context/DojoContext";
import { useQuests } from "@/hooks/helpers/useQuests";
import Button from "@/ui/elements/Button";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Check, ShieldQuestion } from "lucide-react";
import { useState } from "react";

interface Quest {
  name: string;
  description: string;
  steps: Step[];
  completed?: boolean;
  prizes: Prize[];
}

interface Step {
  description: string;
}

interface Prize {
  id: number;
  title: string;
}

export const HintBox = ({ quest, entityId }: { quest: Quest; entityId: bigint }) => {
  const {
    setup: {
      components: { HasClaimedStartingResources },
      systemCalls: { mint_starting_resources },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const handleClaimResources = async (config_id: string) => {
    setIsLoading(true); // Start loading
    try {
      await mint_starting_resources({
        signer: account,
        config_id: config_id,
        realm_entity_id: entityId || "0",
      });
    } catch (error) {
      console.error("Failed to claim resources:", error);
    } finally {
      setIsLoading(false); // Stop loading regardless of success or failure
    }
  };

  return (
    <div className={`p-2 border border-white/30  text-gold  ${quest.completed ? "bg-green/5" : " "}`}>
      <div className="flex justify-between">
        <h5 className="mb-3">{quest.name}</h5>
        {quest.completed ? <Check /> : <ShieldQuestion />}
      </div>

      <p>{quest.description}</p>

      <div className="mt-1 grid grid-cols-3">
        {quest.completed &&
          quest.prizes.map((prize, index) => {
            const hasClaimed = getComponentValue(
              HasClaimedStartingResources,
              getEntityIdFromKeys([BigInt(entityId), BigInt(prize.id)]),
            );
            return (
              <Button
                key={index}
                isLoading={isLoading}
                disabled={hasClaimed?.claimed}
                variant="primary"
                onClick={() => handleClaimResources(prize.id.toString())}
              >
                {hasClaimed?.claimed ? "Claimed" : prize.title}
              </Button>
            );
          })}
      </div>
    </div>
  );
};

export const QuestList = ({ entityId }: { entityId: bigint | undefined }) => {
  const { quests } = useQuests({ entityId: entityId || BigInt("0") });

  return (
    <div className="p-8 flex flex-col gap-2">
      {quests.map((quest, index) => (
        <HintBox key={index} quest={quest} entityId={entityId || BigInt("0")} />
      ))}
    </div>
  );
};
