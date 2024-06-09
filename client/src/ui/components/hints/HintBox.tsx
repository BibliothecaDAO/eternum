import { useDojo } from "@/hooks/context/DojoContext";
import { useQuests } from "@/hooks/helpers/useQuests";
import Button from "@/ui/elements/Button";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Check, ShieldQuestion } from "lucide-react";
import { useMemo, useState } from "react";

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

  const handleAllClaims = async () => {
    setIsLoading(true); // Start loading
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
    } finally {
      setIsLoading(false); // Stop loading regardless of success or failure
    }
  };

  const hasClaimed = useMemo(() => {
    return quest.prizes.every((prize) => {
      const value = getComponentValue(
        HasClaimedStartingResources,
        getEntityIdFromKeys([BigInt(entityId), BigInt(prize.id)]),
      );
      return value?.claimed;
    });
  }, [quest.prizes, entityId]);

  return !hasClaimed ? (
    <div className={`p-4  text-gold clip-angled-sm  ${quest.completed ? "bg-green/5" : " bg-green/40 "}`}>
      <div className="flex justify-between">
        <h5 className="mb-3 font-bold">{quest.name}</h5>
        {quest.completed ? <Check /> : <ShieldQuestion />}
      </div>

      <p className="text-xl mb-4">{quest.description}</p>

      <div className="mt-1 grid grid-cols-3 gap-2">
        {quest.completed && (
          <Button isLoading={isLoading} variant="primary" onClick={() => handleAllClaims()}>
            {"Claim All"}
          </Button>
        )}
      </div>
    </div>
  ) : (
    ""
  );
};

export const QuestList = ({ entityId }: { entityId: bigint | undefined }) => {
  const { quests } = useQuests({ entityId: entityId || BigInt("0") });

  return (
    <div className="p-3 flex flex-col gap-2">
      {quests.map((quest, index) => (
        <HintBox key={index} quest={quest} entityId={entityId || BigInt("0")} />
      ))}
    </div>
  );
};
