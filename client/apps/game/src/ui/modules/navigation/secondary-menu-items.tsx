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

import { useCallback, useMemo } from "react";
import { social } from "../../components/navigation/config";

export const SecondaryMenuItems = () => {
  const {
    setup: {
      components: {
        events: { SeasonEnded },
      },
    },
  } = useDojo();

  const toggleModal = useUIStore((state) => state.toggleModal);
  const { connector } = useAccountStore((state) => state);

  const hasSeasonEnded = useEntityQuery([Has(SeasonEnded)]).length > 0;

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
    if (hasSeasonEnded) {
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
  }, [structureEntityId, hasSeasonEnded]);

  return (
    <div className="flex panel-wood ">
      <div className="top-right-navigation-selector self-center flex ">
        <HomeButton />
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
        <Controller />
      </div>
    </div>
  );
};
