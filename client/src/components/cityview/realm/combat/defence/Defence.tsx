import React from "react";
import clsx from "clsx";
import { CombatInfo } from "../../../../../hooks/helpers/useCombat";
import ProgressBar from "../../../../../elements/ProgressBar";
import Button from "../../../../../elements/Button";

type DefenceProps = {
  watchTower: CombatInfo;
  onReinforce?: () => void;
  onHeal?: () => void;
} & React.HTMLAttributes<HTMLDivElement>;

export const Defence = ({ watchTower, onReinforce, onHeal, ...props }: DefenceProps) => {
  const { health, quantity, attack, defence } = watchTower;

  return (
    <div className={clsx("flex flex-1 w-full", props.className)}>
      <img src={`/images/buildings/defence_tower.png`} className="object-cover rounded-md w-[107px]" />
      <div className="flex flex-col w-full min-w-[244px] h-full ml-2">
        <div className="flex  text-white items-center mb-2">
          <div className="font-bold text-xs">City Tower</div>
          <div className="flex items-center text-xxs ml-auto">
            <div className="text-order-brilliance">{health && health.toLocaleString()}</div>&nbsp;/ {10 * quantity} HP
          </div>
          {onHeal && (
            <Button onClick={onHeal} className="ml-2" variant="success" size="xs">
              Heal
            </Button>
          )}
        </div>
        <div className="grid grid-cols-12 gap-0.5">
          <ProgressBar
            containerClassName="col-span-12 !bg-order-giants"
            rounded
            progress={health ? (health / (10 * quantity)) * 100 : 0}
          />
        </div>
        <div className="mt-2 text-white text-xs grid grid-cols-3 h-28 gap-2">
          <div
            className="rounded flex flex-col items-center justify-center"
            style={{ background: "radial-gradient(120.12% 123.03% at 19.74% -19.25%, #4A4A4A 0%, #000 100%)" }}
          >
            <img src="/images/units/troop-icon.png" className="w-10 h-10 mb-2" />
            <div className=" font-bold">{quantity || 0}</div>
            <div>Defenders</div>
          </div>
          <div
            className="rounded flex flex-col items-center justify-center"
            style={{ background: "radial-gradient(115.26% 117.12% at 26.32% -14.7%, #554C1B 0%, #000 100%)" }}
          >
            <img src="/images/icons/attack.png" className="w-10 h-10 mb-2" />
            <div className=" font-bold">{attack || 0}</div>
            <div>Attack</div>
          </div>
          <div
            className="rounded flex flex-col items-center justify-center"
            style={{ background: "radial-gradient(110.51% 111.69% at 31.58% -10.16%, #20551B 0%, #000 100%)" }}
          >
            <img src="/images/icons/defence.png" className="w-10 h-10 mb-2" />
            <div className=" font-bold">{defence || 0}</div>
            <div>Defence</div>
          </div>
        </div>
        {onReinforce && (
          <Button className="mt-2" onClick={onReinforce} variant="primary">
            Reinforce City Tower
          </Button>
        )}
      </div>
    </div>
  );
};
