import { useMemo, useState } from "react";
import { Headline } from "../../../../../elements/Headline";
import useUIStore from "../../../../../hooks/store/useUIStore";
import Button from "../../../../../elements/Button";
import { useDojo } from "../../../../../DojoContext";
import { NumberInput } from "../../../../../elements/NumberInput";
import { CombatInfo } from "@bibliothecadao/eternum";

type SeparateSoldiersPanelProps = {
  isDefence: boolean;
  selectedRaider: CombatInfo;
  onClose: () => void;
};

export const SeparateSoldiersPanel = ({ isDefence, selectedRaider, onClose }: SeparateSoldiersPanelProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { detach_soldiers },
    },
  } = useDojo();

  const [soldierAmount, setSoldierAmount] = useState(1);
  const [loading, setLoading] = useState(false);

  const soldierProportion = useMemo(() => {
    return soldierAmount / selectedRaider.quantity;
  }, [soldierAmount]);

  const [totalAttack, totalDefence, totalHealth, totalQuantity] = useMemo(() => {
    return [
      Math.round(selectedRaider.attack * (1 - soldierProportion)),
      Math.round(selectedRaider.attack * (1 - soldierProportion)),
      Math.round(selectedRaider.attack * (1 - soldierProportion)),
      Math.round(selectedRaider.quantity * (1 - soldierProportion)),
    ];
  }, [soldierProportion]);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const onBuild = async () => {
    setLoading(true);
    await detach_soldiers({
      signer: account,
      unit_id: selectedRaider.entityId,
      detached_quantity: soldierAmount,
    });
    setLoading(false);
    onClose();
  };

  return (
    <div>
      <div className="flex flex-col items-center p-2">
        <Headline size="big">Military units 1</Headline>
        <div className="flex relative mt-1 mb-1 justify-between text-xxs text-lightest w-full">
          <div className="flex items-center">
            <div className="flex items-center h-6 mr-2">
              <img src="/images/units/troop-icon.png" className="h-[28px]" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold">{`x${totalQuantity} ${isDefence ? "Defenders" : "Raiders"}`}</div>
              </div>
            </div>
          </div>
          <div className="flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center">
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Attack power</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <img src="/images/icons/attack.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{totalAttack}</div>
              </div>
            </div>
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Defence power</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <img src="/images/icons/defence.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{totalDefence}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center">{totalHealth} HP</div>
        </div>
        <Headline size="big">Military units 2</Headline>
        <div className="flex relative mt-1 justify-between text-xxs text-lightest w-full">
          <div className="flex items-center">
            <div className="flex items-center h-6 mr-2">
              <img src="/images/units/troop-icon.png" className="h-[28px]" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold">{`x${selectedRaider.quantity - totalQuantity} Raiders`}</div>
              </div>
            </div>
          </div>
          <div className="flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center">
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Attack power</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <img src="/images/icons/attack.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{selectedRaider.attack - totalAttack}</div>
              </div>
            </div>
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Defence power</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <img src="/images/icons/defence.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{selectedRaider.defence - totalDefence}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center">{selectedRaider.health - totalHealth} HP</div>
        </div>
        <div className="flex flex-col items-center my-4">
          <div className="italic text-light-pink mb-2">New Unit Amount</div>
          <NumberInput
            className="ml-2 mr-2"
            value={soldierAmount}
            onChange={(value) => setSoldierAmount(Math.min(selectedRaider.quantity - 1, Math.max(1, value)))}
            min={1}
            max={999}
            step={1}
          />
        </div>
      </div>
      <div className="flex flex-col items-end justify-center mr-2 mb-2">
        <div className="flex">
          <Button className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto" onClick={onClose} variant="outline">
            {`Cancel`}
          </Button>
          <Button
            className="!px-[6px] !py-[2px] text-xxs ml-auto"
            disabled={!(soldierAmount > 0)}
            onClick={onBuild}
            variant="outline"
            isLoading={loading}
          >
            {`Build`}
          </Button>
        </div>
        {!(soldierAmount > 0) && <div className="text-xxs text-order-giants/70">Merge at least 1 unit</div>}
      </div>
    </div>
  );
};
