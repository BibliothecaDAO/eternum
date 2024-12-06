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

export const SecondaryMenuItems = () => {
  const {
    setup: {
      systemCalls: { claim_quest },
      components: {
        events: { GameEnded },
      },
      account: { account },
    },
  } = useDojo();

  const { toggleModal } = useModalStore();
  const { connector } = useAccountStore();
  const { quests } = useQuests();

  const { unclaimedQuestsCount } = useUnclaimedQuestsCount();
  const gameEnded = useEntityQuery([Has(GameEnded)]);

  const currentQuest = quests?.find(
    (quest: any) => quest.status === QuestStatus.InProgress || quest.status === QuestStatus.Completed,
  );
  const { handleStart } = useTutorial(questSteps.get(currentQuest?.id || QuestType.Settle), true);

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const [isLoading, setIsLoading] = useState(false);
  const [skipQuest, setSkipQuest] = useState(false);

  const handleTrophyClick = useCallback(() => {
    if (!connector?.controller) {
      console.error("Connector not initialized");
      return;
    }
    connector.controller.openProfile("trophies");
  }, [connector]);

  const handleAllClaims = async () => {
    setSkipQuest(false);
    setIsLoading(true);
    try {
      await claim_quest({
        signer: account,
        quest_ids: currentQuest?.prizes.map((prize) => BigInt(prize.id)) || [],
        receiver_id: structureEntityId || 0,
      });
    } catch (error) {
      console.error(`Failed to claim resources for quest ${currentQuest?.name}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const secondaryNavigation = useMemo(() => {
    const buttons = [
      {
        button: unclaimedQuestsCount > 0 && (
          <div className="flex items-center gap-2 bg-brown/90 border border-gold/30 rounded-full px-4 h-10 md:h-12">
            <Button
              isLoading={isLoading}
              className={clsx(
                "claim-selector text-gold hover:text-gold/80 text-sm font-semibold bg-transparent capitalize",
                {
                  "animate-pulse duration-700 border-b-4 border-gold/50 hover:border-gold/70 transition-all":
                    currentQuest?.status === QuestStatus.Completed,
                },
              )}
              onClick={handleAllClaims}
              disabled={currentQuest?.status !== QuestStatus.Completed}
            >
              Claim
            </Button>

            <div className="h-6 w-px bg-gold/30 mx-2" />

            <Button
              onClick={() => handleStart()}
              className={clsx("tutorial-selector text-gold text-sm bg-transparent capitalize", {
                "animate-pulse duration-700 border-b-4 border-gold/50 hover:border-gold/70 transition-all":
                  currentQuest?.status !== QuestStatus.Completed,
              })}
            >
              {/* <span className="font-semibold">Current Quest</span> */}
              <span className="font-semibold">{currentQuest?.name}</span>
              {/* <span className="text-xs ml-2">({unclaimedQuestsCount} remaining)</span> */}
            </Button>

            <div className="h-6 w-px bg-gold/30 mx-2" />

            {skipQuest ? (
              <div>
                <Button
                  className="text-gold hover:text-gold/80 text-sm font-semibold bg-transparent capitalize"
                  onClick={handleAllClaims}
                  variant="red"
                >
                  Confirm
                </Button>
                <Button
                  className="text-gold hover:text-gold/80 text-sm font-semibold bg-transparent capitalize"
                  onClick={() => setSkipQuest(false)}
                >
                  Back
                </Button>
              </div>
            ) : (
              <Button
                className="text-gold hover:text-gold/80 text-sm font-semibold bg-transparent capitalize"
                onClick={() => setSkipQuest(true)}
              >
                Skip Quest
              </Button>
            )}
          </div>
        ),
      },
      {
        button: (
          <CircleButton
            className="social-selector"
            tooltipLocation="bottom"
            image={BuildingThumbs.guild}
            label={social}
            active={isPopupOpen(social)}
            size="lg"
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
            size="lg"
            onClick={() => togglePopup(rewards)}
          />
        ),
      });
    }
    return buttons;
  }, [unclaimedQuestsCount, quests, currentQuest, structureEntityId, gameEnded]);

  return (
    <div className="flex gap-1 md:gap-3">
      <div className="top-right-navigation-selector self-center px-1 md:px-3 flex space-x-1 md:space-x-2 my-1">
        {secondaryNavigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
        <CircleButton
          className="trophies-selector"
          image={BuildingThumbs.trophy}
          label={"Trophies"}
          size="lg"
          onClick={handleTrophyClick}
        />
        <CircleButton
          className="hints-selector"
          image={BuildingThumbs.question}
          label={"Lordpedia"}
          size="lg"
          onClick={() => toggleModal(<HintModal />)}
        />
        <CircleButton
          className="discord-selector"
          tooltipLocation="bottom"
          image={BuildingThumbs.discord}
          label={"Discord"}
          size="lg"
          onClick={() => window.open("https://discord.gg/realmsworld")}
        />
        <CircleButton
          className="settings-selector"
          tooltipLocation="bottom"
          active={isPopupOpen(settings)}
          image={BuildingThumbs.settings}
          label={"Support"}
          size="lg"
          onClick={() => togglePopup(settings)}
        />
      </div>
    </div>
  );
};
