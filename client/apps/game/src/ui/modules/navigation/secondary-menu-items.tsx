import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintModal } from "@/ui/components/hints/hint-modal";
import { HomeButton } from "@/ui/components/home-button";
import { rewards, settings } from "@/ui/components/navigation/config";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/circle-button";
import { Controller } from "@/ui/modules/controller/controller";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import { useAccount } from "@starknet-react/core";
import { useCallback, useMemo } from "react";
import { social } from "../../components/navigation/config";

export const SecondaryMenuItems = () => {
  const {
    setup: {
      components: {
        events: { GameEnded },
      },
    },
  } = useDojo();

  const toggleModal = useUIStore((state) => state.toggleModal);
  const { connector } = useAccountStore();

  const gameEnded = useEntityQuery([Has(GameEnded)]);
  const { isConnected } = useAccount();

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
            size="md"
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
            size="md"
            className="border-none"
            onClick={() => togglePopup(rewards)}
          />
        ),
      });
    }
    return buttons;
  }, [structureEntityId, gameEnded]);

  return (
    <div className="flex ">
      <div className="top-right-navigation-selector self-center flex ">
        {secondaryNavigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
        <CircleButton
          className="trophies-selector border-none"
          image={BuildingThumbs.trophy}
          label={"Trophies"}
          size="md"
          onClick={handleTrophyClick}
        />
        <CircleButton
          className="hints-selector border-none"
          image={BuildingThumbs.question}
          label={"Lordpedia"}
          size="md"
          onClick={() => toggleModal(<HintModal />)}
        />
        <CircleButton
          className="discord-selector border-none"
          tooltipLocation="bottom"
          image={BuildingThumbs.discord}
          label={"Discord"}
          size="md"
          onClick={() => window.open("https://discord.gg/realmsworld")}
        />
        <CircleButton
          className="settings-selector border-none"
          tooltipLocation="bottom"
          active={isPopupOpen(settings)}
          image={BuildingThumbs.settings}
          label={"Settings"}
          size="md"
          onClick={() => togglePopup(settings)}
        />
        <Controller className="!bg-black !border-none !text-gold" iconClassName="!fill-current !text-gold" />
        <HomeButton />
      </div>
      {/* {isConnected && (
        <div className="absolute top-16 right-0 bg-brown/90 mx-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => window.open("https://empire.realms.world/trade", "_blank", "noopener,noreferrer")}
          >
            <div className="flex items-center gap-2">
              <ResourceIcon resource="Lords" size="xs" />
              Bridge Lords & Resources
            </div>
          </Button>
        </div>
      )} */}
    </div>
  );
};
