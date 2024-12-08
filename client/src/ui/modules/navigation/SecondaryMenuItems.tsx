import { useAccountStore } from "@/hooks/context/accountStore";
import { useDojo } from "@/hooks/context/DojoContext";
import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { HintModal } from "@/ui/components/hints/HintModal";
import { rewards, settings } from "@/ui/components/navigation/Config";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import { useCallback, useMemo } from "react";
import { social } from "../../components/navigation/Config";
import { Controller } from "../controller/Controller";

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
      <div className="top-right-navigation-selector self-center px-1 md:px-3 flex space-x-4 md:space-x-4 mt-2">
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
        <Controller
          className="!bg-black !border-none !text-gold hover:!opacity-80"
          iconClassName="!fill-current !text-gold"
        />
      </div>
    </div>
  );
};
