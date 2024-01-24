import React from "react";
import clsx from "clsx";
import ProgressBar from "../../../../../elements/ProgressBar";
import Button from "../../../../../elements/Button";
import { Guilds } from "@bibliothecadao/eternum";
import { SelectLaborResourceComponent } from "./SelectLaborResourceComponent";

type LaborBuildingProps = {
  guild: number;
  setShowPopup: (show: boolean) => void;
  selectedLaborResource: number | undefined;
  setSelectedLaborResource: (resource: number) => void;
} & React.HTMLAttributes<HTMLDivElement>;

export const LaborBuilding = ({
  guild,
  selectedLaborResource,
  setSelectedLaborResource,
  setShowPopup,
  ...props
}: LaborBuildingProps) => {
  const { health, quantity, attack, defence } = { health: 0, quantity: 0, attack: 0, defence: 0 };

  const guildLevel = 10;
  const experienceDiscount = 1;
  const totalDiscount = 0.75;

  return (
    <div className={clsx("flex flex-1 w-full", props.className)}>
      <img src={`/images/buildings/defence_tower.png`} className="object-cover rounded-md w-[107px]" />
      <div className="flex flex-col w-full min-w-[244px] h-full ml-2">
        <div className="flex flex-row mb-1">
          <div className="flex items-center font-bold text-white text-xs mr-2">{Guilds[guild]} Guild </div>
          <div className={" p-1 bg-gold/10 rounded-xl text-gold font-bold text-xxs"}>LVL {guildLevel}</div>
        </div>
        <div className="flex text-white items-end mb-2">
          <div className="flex flex-col items-start">
            <div className="flex flex-row text-xxs justify-center">
              <span className="mr-1 text-gold">{`Level Discount: `}</span>
              <span className="text-order-brilliance">{`×${experienceDiscount}`}</span>
            </div>
            <div className="flex flex-row text-xxs justify-center">
              <span className="mr-1 text-gold">{`Zone Discount: `}</span>
              <span className="text-order-brilliance">{`×${totalDiscount}`}</span>
            </div>
            <div className="flex flex-row text-xxs justify-center">
              <span className="mr-1 text-gold">{`Total Discount: `}</span>
              <span className="text-order-brilliance">{`×${experienceDiscount}`}</span>
            </div>
          </div>
        </div>
        <SelectLaborResourceComponent
          selectedLaborResource={selectedLaborResource}
          setSelectedLaborResource={setSelectedLaborResource}
          guild={guild}
        />
        <div className="flex flex-row justify-between">
          <Button className="mt-2 w-full mr-2" onClick={() => {}} variant="outline" size="xs">
            Destroy Guild
          </Button>
          <Button
            disabled={!selectedLaborResource}
            size="xs"
            className="mt-2 w-full"
            onClick={() => {
              setShowPopup(true);
            }}
            variant="primary"
          >
            Purchase Labor
          </Button>
        </div>
      </div>
    </div>
  );
};
