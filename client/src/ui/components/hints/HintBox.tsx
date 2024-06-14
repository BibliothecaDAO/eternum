import { useDojo } from "@/hooks/context/DojoContext";
import { useQuests } from "@/hooks/helpers/useQuests";
import Button from "@/ui/elements/Button";
import { Check, ShieldQuestion } from "lucide-react";
import { useMemo, useState } from "react";
import useUIStore from "@/hooks/store/useUIStore";
import { quests } from "../../components/navigation/Config";
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

  const togglePopup = useUIStore((state) => state.togglePopup);

  const [isLoading, setIsLoading] = useState(false);

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
    } finally {
      setIsLoading(false);
      togglePopup(quests);
    }
  };

  return !quest.claimed ? (
    <div className={`p-4  text-gold clip-angled-sm  ${quest.completed ? "bg-green/5" : " bg-green/40 "}`}>
      <div className="flex justify-between">
        <h5 className="mb-3 font-bold">{quest.name}</h5>
        {quest.completed ? <Check /> : <ShieldQuestion />}
      </div>

      <p className="text-xl mb-4">{quest.description}</p>

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

export const QuestList = ({ entityId }: { entityId: bigint | undefined }) => {
  const { quests } = useQuests({ entityId: entityId || BigInt("0") });

  const firstUnclaimedQuest = useMemo(() => {
    return quests.find((quest: Quest) => !quest.claimed);
  }, [quests]);

  return (
    <div className="p-3 flex flex-col gap-2">
      {firstUnclaimedQuest && <HintBox quest={firstUnclaimedQuest} entityId={entityId || BigInt("0")} />}
    </div>
  );
};
