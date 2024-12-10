import { useDojo } from "@/hooks/context/DojoContext";
import { Prize, QuestStatus, useQuests, useUnclaimedQuestsCount } from "@/hooks/helpers/useQuests";
import { useRealm } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import { questSteps, useTutorial } from "@/hooks/use-tutorial";
import Button from "@/ui/elements/Button";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { QuestType } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useState } from "react";

export const QuestsMenu = () => {
  const {
    account: { account },
    setup: {
      systemCalls: { claim_quest },
    },
  } = useDojo();

  const { quests } = useQuests();
  const { unclaimedQuestsCount } = useUnclaimedQuestsCount();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const currentQuest = quests?.find(
    (quest: any) => quest.status === QuestStatus.InProgress || quest.status === QuestStatus.Completed,
  );

  const { handleStart } = useTutorial(questSteps.get(currentQuest?.id || QuestType.Settle));

  const [isLoading, setIsLoading] = useState(false);
  const [skipQuest, setSkipQuest] = useState(false);

  const handleClaimQuest = async () => {
    setSkipQuest(false);
    setIsLoading(true);
    try {
      await claim_quest({
        signer: account,
        quest_ids: currentQuest?.prizes.map((prize) => BigInt(prize.id)) || [],
        receiver_id: structureEntityId,
      });

      if (currentQuest?.id === QuestType.CreateTrade) {
        localStorage.setItem("tutorial", "completed");
      }
    } catch (error) {
      console.error(`Failed to claim resources for quest ${currentQuest?.name}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimAllQuests = async () => {
    const unclaimedQuests = quests?.filter((quest: any) => quest.status !== QuestStatus.Claimed);

    setSkipQuest(false);
    setIsLoading(true);
    try {
      await claim_quest({
        signer: account,
        quest_ids: unclaimedQuests.flatMap((quest) => quest.prizes.map((prize) => BigInt(prize.id))),
        receiver_id: structureEntityId,
      });

      localStorage.setItem("tutorial", "completed");
    } catch (error) {
      console.error(`Failed to claim resources for quests:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipWidth = 300;

    let x = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (x + tooltipWidth > window.innerWidth) {
      x = window.innerWidth - tooltipWidth - 20;
    }
    if (x < 20) {
      x = 20;
    }

    setTooltip({
      content: <QuestRewards prizes={currentQuest?.prizes} />,
      position: "bottom",
      fixed: {
        x: x,
        y: rect.bottom + 10,
      },
    });
  };

  return (
    unclaimedQuestsCount > 0 && (
      <div className="flex gap-2 bg-brown/90 border border-gold/30 rounded-full px-4 h-10 md:h-12 py-2">
        <Button
          variant="outline"
          isLoading={isLoading}
          className={clsx("claim-selector text-sm !font-bold capitalize", {
            "!border-gold/70 !text-brown !bg-gold hover:!bg-gold/70 animate-pulse hover:animate-none":
              currentQuest?.status === QuestStatus.Completed,
          })}
          onClick={handleClaimQuest}
          onMouseEnter={handleClaimMouseEnter}
          onMouseLeave={() => setTooltip(null)}
          disabled={currentQuest?.status !== QuestStatus.Completed}
        >
          Claim
        </Button>

        <div className="h-full flex items-center">
          <div className="h-[80%] w-px bg-gold/30 mx-2" />
        </div>

        <Button
          onClick={() => handleStart()}
          variant="outline"
          disabled={currentQuest?.status === QuestStatus.Completed && currentQuest.id !== QuestType.Settle}
          className={clsx("tutorial-selector relative text-sm capitalize", {
            "!border-gold/70 !text-brown !bg-gold hover:!bg-gold/70 animate-pulse hover:animate-none":
              currentQuest?.status !== QuestStatus.Completed,
          })}
        >
          <span className="font-semibold">{currentQuest?.name}</span>
          <div
            className={clsx(
              "absolute animate-bounce rounded-full border border-green/30 bg-green/90 text-brown px-1.5 md:px-2 text-[0.6rem] md:text-xxs z-[100] font-bold -top-1 -right-1",
            )}
          >
            {unclaimedQuestsCount}
          </div>
        </Button>

        <div className="h-full flex items-center">
          <div className="h-[70%] w-px bg-gold/30 mx-2" />
        </div>

        {skipQuest ? (
          <div className="flex flex-row gap-4">
            <Button className="text-sm font-semibold capitalize" onClick={handleClaimAllQuests} variant="red">
              Skip All Quests
            </Button>
            <Button className="text-sm font-semibold capitalize" onClick={handleClaimQuest} variant="red">
              Confirm
            </Button>
            <Button variant="primary" className="text-sm font-semibold capitalize" onClick={() => setSkipQuest(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="primary" className="text-sm font-semibold capitalize w-6" onClick={() => setSkipQuest(true)}>
            Skip
          </Button>
        )}
      </div>
    )
  );
};

const QuestRewards = ({ prizes }: { prizes: Prize[] | undefined }) => {
  const { getQuestResources } = useRealm();

  return (
    <div className="w-full max-w-xs py-2">
      {prizes &&
        prizes.map((prize, index) => (
          <div key={index} className="flex flex-wrap gap-1.5 mb-1.5">
            {getQuestResources()[prize.id].map((resource, i) => (
              <div key={i} className="flex-grow-0">
                <ResourceCost resourceId={resource.resource} amount={resource.amount} />
              </div>
            ))}
          </div>
        ))}
    </div>
  );
};
