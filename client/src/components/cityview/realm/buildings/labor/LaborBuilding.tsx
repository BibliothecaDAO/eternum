import React, { useMemo, useState } from "react";
import clsx from "clsx";
import Button from "../../../../../elements/Button";
import { Guilds } from "@bibliothecadao/eternum";
import { SelectLaborResourceComponent } from "./SelectLaborResourceComponent";
import useUIStore from "../../../../../hooks/store/useUIStore";
import { useDojo } from "../../../../../DojoContext";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useBuildings } from "../../../../../hooks/helpers/useBuildings";
import { useLabor } from "../../../../../hooks/helpers/useLabor";
import { getPosition, getZone } from "../../../../../utils/utils";

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
  const {
    account: { account },
    setup: {
      systemCalls: { destroy_labor_building },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const realmId = useRealmStore((state) => state.realmId);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onDestroy = async () => {
    setIsLoading(true);
    await destroy_labor_building({
      realm_entity_id: realmEntityId,
      signer: account,
    });
    setIsLoading(false);
  };

  const setTooltip = useUIStore((state) => state.setTooltip);
  const { getLaborBuilding } = useBuildings();
  const { useLaborAuctionCoefficient } = useLabor();

  const building = getLaborBuilding();

  const guildLevel = Number(building?.level || 0);
  const experienceDiscount = 0.9 ** guildLevel;

  const position = realmId ? getPosition(realmId) : undefined;
  const zone = position ? getZone(position.x) : undefined;
  const zoneDiscount = zone ? useLaborAuctionCoefficient(zone) : undefined;

  const totalDiscount = zoneDiscount ? experienceDiscount * zoneDiscount : undefined;

  return (
    <div className={clsx("flex flex-1 w-full", props.className)}>
      <img
        src={`/images/buildings/${Guilds[guild - 1]?.toLowerCase()}-building.png`}
        className="object-cover rounded-md w-[107px] h-[230px]"
      />
      <div className="flex flex-col w-full min-w-[244px] h-full ml-2">
        <div className="flex flex-row mb-2 justify-between">
          <div className="flex flex-row">
            <div className="flex items-center font-bold text-white text-xs mr-2">{Guilds[guild - 1]} Guild </div>
            <div className={" p-1 bg-gold/10 rounded-xl text-gold font-bold text-xxs"}>LVL {guildLevel}</div>
          </div>
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: (
                  <div className="z-50 ">
                    <p className="whitespace-nowrap">Labor units before next level</p>
                    <div className="flex flex-row justify-center mt-1">
                      <p className="whitespace-nowrap">Next discount:</p>
                      <p className="whitespace-nowrap text-order-brilliance ml-1">
                        ×{(0.9 ** (guildLevel + 1)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ),
              })
            }
            onMouseLeave={() => {
              setTooltip(null);
            }}
            className="flex flex-row ml-2"
          >
            <div className="flex items-center font-bold text-white text-xs mr-2">
              {`${building?.labor_count || 0} / ${(guildLevel + 1) * 10}`}{" "}
            </div>
          </div>
        </div>
        <div className="flex flex-row w-full items-center align-center justify-between mb-3">
          <div className="flex flex-col text-xxs justify-center text-center rounded-md border  bg-black p-1">
            <span className="text-order-brilliance text-xl mb-1">{`×${experienceDiscount.toFixed(2)}`}</span>
            <span className="mr-1 text-gold">{`Guild Discount`}</span>
          </div>
          {zoneDiscount && (
            <div className="flex flex-col text-xxs justify-center text-center rounded-md border  bg-black p-1">
              <span className="text-order-brilliance text-xl mb-1">{`×${zoneDiscount.toFixed(2)}`}</span>
              <span className="mr-1 text-gold ">{`Zone Discount`}</span>
            </div>
          )}
          {totalDiscount && (
            <div className="flex flex-col text-xxs justify-center text-center rounded-md border  bg-black p-1">
              <span className="text-order-brilliance text-xl mb-1">{`×${totalDiscount.toFixed(2)}`}</span>
              <span className="mr-1 text-gold">{`Final Discount`}</span>
            </div>
          )}
        </div>
        <SelectLaborResourceComponent
          selectedLaborResource={selectedLaborResource}
          setSelectedLaborResource={setSelectedLaborResource}
          guild={guild}
        />
        <div className="flex flex-row justify-between">
          <Button className="mt-2 w-full mr-2" isLoading={isLoading} onClick={onDestroy} variant="outline" size="md">
            Destroy Guild
          </Button>
          <Button
            disabled={!selectedLaborResource}
            size="md"
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
