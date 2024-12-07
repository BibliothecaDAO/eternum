import { useAccountStore } from "@/hooks/context/accountStore";
import { useDojo } from "@/hooks/context/DojoContext";
import { QuestStatus, useQuests, useUnclaimedQuestsCount } from "@/hooks/helpers/useQuests";
import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { questSteps, useTutorial } from "@/hooks/use-tutorial";
import { HintModal } from "@/ui/components/hints/HintModal";
import { rewards, settings } from "@/ui/components/navigation/Config";
import { BuildingThumbs } from "@/ui/config";
import Button from "@/ui/elements/Button";
import CircleButton from "@/ui/elements/CircleButton";
import { QuestType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import { social } from "../../components/navigation/Config";
import { Controller } from "../controller/Controller";

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

  return (
    unclaimedQuestsCount > 0 && (
      <div className="flex gap-2 bg-brown/90 border border-gold/30 rounded-full px-4 h-10 md:h-12 py-2">
        <Button
          variant="primary"
          isLoading={isLoading}
          className={clsx(
            "claim-selector text-gold hover:text-gold/80 text-sm font-semibold bg-transparent capitalize",
            {
              "animate-pulse duration-700 border-b-4 border-gold/50 hover:border-gold/70 transition-all":
                currentQuest?.status === QuestStatus.Completed,
            },
          )}
          onClick={handleClaimQuest}
          disabled={currentQuest?.status !== QuestStatus.Completed}
        >
          Claim
        </Button>

        <div className="h-full flex items-center">
          <div className="h-[80%] w-px bg-gold/30 mx-2" />
        </div>

        <Button
          onClick={() => handleStart()}
          variant="primary"
          disabled={currentQuest?.status === QuestStatus.Completed}
          className={clsx("tutorial-selector relative text-gold text-sm bg-transparent capitalize", {
            "animate-pulse duration-700 border-b-4 border-gold/50 hover:border-gold/70 transition-all":
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
            <Button
              className="text-gold hover:text-gold/80 text-sm font-semibold bg-transparent capitalize"
              onClick={handleClaimAllQuests}
              variant="red"
            >
              Skip All Quests
            </Button>
            <Button
              className="text-gold hover:text-gold/80 text-sm font-semibold bg-transparent capitalize"
              onClick={handleClaimQuest}
              variant="red"
            >
              Confirm
            </Button>
            <Button
              variant="primary"
              className="text-gold hover:text-gold/80 text-sm font-semibold bg-transparent capitalize"
              onClick={() => setSkipQuest(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            className="text-gold hover:text-gold/80 text-sm font-semibold bg-transparent capitalize"
            onClick={() => setSkipQuest(true)}
          >
            Skip Quest ?
          </Button>
        )}
      </div>
    )
  );
};

export const SecondaryMenuItems = () => {
  const {
    setup: {
      components: {
        events: { GameEnded },
      },
    },
  } = useDojo();

  const { toggleModal } = useModalStore();
  const { connector } = useAccountStore();

  const gameEnded = useEntityQuery([Has(GameEnded)]);

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const handleTrophyClick = useCallback(() => {
    if (!connector?.controller) {
      console.error("Connector not initialized");
      return;
    }
    connector.controller.openProfile("trophies");
  }, [connector]);

  const secondaryNavigation = useMemo(() => {
    const buttons = [
      {
        button: (
          <CircleButton
            className="social-selector border-none"
            tooltipLocation="bottom"
            image={BuildingThumbs.guild}
            label={social}
            active={isPopupOpen(social)}
            size="sm"
            onClick={() => togglePopup(social)}
          />
        ),
      },
    ];
    if (gameEnded.length !== 0) {
      buttons.push({
        button: (
          <CircleButton
            tooltipLocation="bottom"
            image={BuildingThumbs.rewards}
            label={rewards}
            active={isPopupOpen(rewards)}
            size="sm"
            className="border-none"
            onClick={() => togglePopup(rewards)}
          />
        ),
      });
    }
    return buttons;
  }, [structureEntityId, gameEnded]);

  return (
    <div className="flex gap-1 md:gap-4">
      <div className="top-right-navigation-selector self-center px-1 md:px-3 flex space-x-4 md:space-x-4 my-4">
        {secondaryNavigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
        <CircleButton
          className="trophies-selector border-none"
          image={BuildingThumbs.trophy}
          label={"Trophies"}
          size="sm"
          onClick={handleTrophyClick}
        />
        <CircleButton
          className="hints-selector border-none"
          image={BuildingThumbs.question}
          label={"Lordpedia"}
          size="sm"
          onClick={() => toggleModal(<HintModal />)}
        />
        <CircleButton
          className="discord-selector border-none"
          tooltipLocation="bottom"
          image={BuildingThumbs.discord}
          label={"Discord"}
          size="sm"
          onClick={() => window.open("https://discord.gg/realmsworld")}
        />
        <CircleButton
          className="settings-selector border-none"
          tooltipLocation="bottom"
          active={isPopupOpen(settings)}
          image={BuildingThumbs.settings}
          label={"Support"}
          size="sm"
          onClick={() => togglePopup(settings)}
        />
        <Controller className="!bg-black !border-none !text-gold" iconClassName="!fill-current !text-gold" />
      </div>
    </div>
  );
};
