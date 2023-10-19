import React from "react";
import { ResourcesIds, findResourceById } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { ResourceIcon } from "./ResourceIcon";
import { soundSelector, useUiSounds } from "../hooks/useUISound";
import { currencyFormat } from "../utils/utils";
import useUIStore from "../hooks/store/useUIStore";

type SelectableResourceProps = {
  resourceId: number;
  amount?: number;
  selected?: boolean;
  disabled?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const SelectableResource = ({ resourceId, amount, selected, disabled, onClick }: SelectableResourceProps) => {
  const resource = findResourceById(resourceId);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const { play: playAddWood } = useUiSounds(soundSelector.addWood);
  const { play: playAddStone } = useUiSounds(soundSelector.addStone);
  const { play: playAddCoal } = useUiSounds(soundSelector.addCoal);
  const { play: playAddCopper } = useUiSounds(soundSelector.addCopper);
  const { play: playAddObsidian } = useUiSounds(soundSelector.addObsidian);
  const { play: playAddSilver } = useUiSounds(soundSelector.addSilver);
  const { play: playAddIronwood } = useUiSounds(soundSelector.addIronwood);
  const { play: playAddColdIron } = useUiSounds(soundSelector.addColdIron);
  const { play: playAddGold } = useUiSounds(soundSelector.addGold);
  const { play: playAddHartwood } = useUiSounds(soundSelector.addHartwood);
  const { play: playAddDiamonds } = useUiSounds(soundSelector.addDiamonds);
  const { play: playAddSapphire } = useUiSounds(soundSelector.addSapphire);
  const { play: playAddRuby } = useUiSounds(soundSelector.addRuby);
  const { play: playAddDeepCrystal } = useUiSounds(soundSelector.addDeepCrystal);
  const { play: playAddIgnium } = useUiSounds(soundSelector.addIgnium);
  const { play: playAddEtherealSilica } = useUiSounds(soundSelector.addEtherealSilica);

  const { play: playAddTrueIce } = useUiSounds(soundSelector.addTrueIce);
  const { play: playAddTwilightQuartz } = useUiSounds(soundSelector.addTwilightQuartz);
  const { play: playAddAlchemicalSilver } = useUiSounds(soundSelector.addAlchemicalSilver);
  const { play: playAddAdamantine } = useUiSounds(soundSelector.addAdamantine);
  const { play: playAddMithral } = useUiSounds(soundSelector.addMithral);
  const { play: playAddDragonhide } = useUiSounds(soundSelector.addDragonhide);
  const { play: playAddWheat } = useUiSounds(soundSelector.addWheat);
  const { play: playAddFish } = useUiSounds(soundSelector.addFish);

  const playResourceSound = (resourceId: ResourcesIds) => {
    // eslint-disable-next-line sonarjs/no-small-switch
    switch (resourceId) {
      case ResourcesIds.Wood:
        playAddWood();
        break;
      case ResourcesIds.Stone:
        playAddStone();
        break;
      case ResourcesIds.Coal:
        playAddCoal();
        break;
      case ResourcesIds.Copper:
        playAddCopper();
        break;
      case ResourcesIds.Obsidian:
        playAddObsidian();
        break;
      case ResourcesIds.Silver:
        playAddSilver();
        break;
      case ResourcesIds.Ironwood:
        playAddIronwood();
        break;
      case ResourcesIds.ColdIron:
        playAddColdIron();
        break;
      case ResourcesIds.Gold:
        playAddGold();
        break;
      case ResourcesIds.Hartwood:
        playAddHartwood();
        break;
      case ResourcesIds.Diamonds:
        playAddDiamonds();
        break;
      case ResourcesIds.Sapphire:
        playAddSapphire();
        break;
      case ResourcesIds.Ruby:
        playAddRuby();
        break;
      case ResourcesIds.DeepCrystal:
        playAddDeepCrystal();
        break;
      case ResourcesIds.Ignium:
        playAddIgnium();
        break;
      case ResourcesIds.EtherealSilica:
        playAddEtherealSilica();
        break;
      case ResourcesIds.TrueIce:
        playAddTrueIce();
        break;
      case ResourcesIds.TwilightQuartz:
        playAddTwilightQuartz();
        break;
      case ResourcesIds.AlchemicalSilver:
        playAddAlchemicalSilver();
        break;
      case ResourcesIds.Adamantine:
        playAddAdamantine();
        break;
      case ResourcesIds.Mithral:
        playAddMithral();
        break;
      case ResourcesIds.Dragonhide:
        playAddDragonhide();
        break;
      case ResourcesIds.Wheat:
        playAddWheat();
        break;
      case ResourcesIds.Fish:
        playAddFish();
        break;
      default:
        break;
    }
  };

  return (
    <div
      onMouseEnter={() =>
        setTooltip({
          position: "bottom",
          content: (
            <>
              <div className="relative z-50 flex flex-col items-center justify-center mb-1 text-xs text-center text-lightest">
                {resource?.trait}
                <div className="mt-0.5 font-bold">{currencyFormat(amount || 0, 0)}</div>
              </div>
            </>
          ),
        })
      }
      onMouseLeave={() => setTooltip(null)}
      onClick={(e) => {
        if (!disabled && onClick) {
          onClick(e);
          playResourceSound(resourceId);
        }
      }}
      className={clsx(
        "p-3 relative cursor-pointer group border border-transparent transition-colors duration-200 rounded-xl bg-black/60 hover:border-lightest",
        selected && "!border-gold",
        disabled && "opacity-30 cursor-not-allowed pointer-events-none",
      )}
    >
      <ResourceIcon withTooltip={false} resource={resource?.trait || ""} size="xs" />
    </div>
  );
};
