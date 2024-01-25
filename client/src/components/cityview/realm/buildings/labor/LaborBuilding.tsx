import React from "react";
import clsx from "clsx";
import ProgressBar from "../../../../../elements/ProgressBar";
import Button from "../../../../../elements/Button";
import { Guilds } from "@bibliothecadao/eternum";
import { SelectLaborResourceComponent } from "./SelectLaborResourceComponent";
import useUIStore from "../../../../../hooks/store/useUIStore";

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
  const setTooltip = useUIStore((state) => state.setTooltip);

  const { health, quantity, attack, defence } = { health: 0, quantity: 0, attack: 0, defence: 0 };

  const guildLevel = 10;
  const experienceDiscount = 0.84;
  const zoneDiscount = 0.5;
  const totalDiscount = 0.75;

  return (
    <div className={clsx("flex flex-1 w-full", props.className)}>
      <img
        src={`/images/buildings/${Guilds[guild].toLowerCase()}-building.png`}
        className="object-cover rounded-md w-[107px]"
      />
      <div className="flex flex-col w-full min-w-[244px] h-full ml-2">
        <div className="flex flex-row mb-2 justify-between">
          <div className="flex flex-row">
            <div className="flex items-center font-bold text-white text-xs mr-2">{Guilds[guild]} Guild </div>
            <div className={" p-1 bg-gold/10 rounded-xl text-gold font-bold text-xxs"}>LVL {guildLevel}</div>
          </div>
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: (
                  <>
                    <p className="whitespace-nowrap">Labor units before next level</p>
                    <div className="flex flex-row mt-1">
                      <p className="whitespace-nowrap">Next discount:</p>
                      <p className="whitespace-nowrap text-order-brilliance">×{0.75}</p>
                    </div>
                  </>
                ),
              })
            }
            onMouseLeave={() => {
              setTooltip(null);
            }}
            className="flex flex-row ml-2"
          >
            <div className="flex items-center font-bold text-white text-xs mr-2">100 / 400 </div>
          </div>
        </div>
        <div className="flex flex-row w-full items-center align-center justify-between mb-3">
          <div className="flex flex-col text-xxs justify-center text-center rounded-md border  bg-black p-1">
            <span className="text-order-brilliance text-xl mb-1">{`×${experienceDiscount}`}</span>
            <span className="mr-1 text-gold">{`Guild Discount`}</span>
          </div>
          <div className="flex flex-col text-xxs justify-center text-center rounded-md border  bg-black p-1">
            <span className="text-order-brilliance text-xl mb-1">{`×${zoneDiscount}`}</span>
            <span className="mr-1 text-gold ">{`Zone Discount`}</span>
          </div>
          <div className="flex flex-col text-xxs justify-center text-center rounded-md border  bg-black p-1">
            <span className="text-order-brilliance text-xl mb-1">{`×${totalDiscount}`}</span>
            <span className="mr-1 text-gold">{`Final Discount`}</span>
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
