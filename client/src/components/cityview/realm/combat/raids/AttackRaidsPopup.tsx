import { useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { calculateCombatSuccess, calculateStealSuccess } from "../../../../../utils/combat";
import { CombatInfo, useCombat } from "../../../../../hooks/helpers/useCombat";
import { Defence } from "../defence/Defence";
import { useComponentValue } from "@dojoengine/react";
import { SelectRaiders } from "./SelectRaiders";

type RoadBuildPopupProps = {
  selectedRaider: CombatInfo;
  onClose: () => void;
};

export const AttackRaidsPopup = ({ selectedRaider, onClose }: RoadBuildPopupProps) => {
  const { position } = selectedRaider;

  const [step, setStep] = useState<number>(1);
  const [selectedRaiders, setSelectedRaiders] = useState([]);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { getEntitiesCombatInfo, useRealmRaidersOnPosition } = useCombat();

  const attackingEntities = useRealmRaidersOnPosition(realmEntityId, position);

  const attackingRaiders = useMemo(() => {
    return getEntitiesCombatInfo(attackingEntities);
  }, [attackingEntities]);

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Attack Realm:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"800px"}>
        <div className="flex flex-col items-center p-2">
          {step == 1 && (
            <SelectRaidersPanel
              setStep={setStep}
              onClose={onClose}
              attackingRaiders={attackingRaiders}
              selectedRaiders={selectedRaiders}
              setSelectedRaiders={setSelectedRaiders}
            ></SelectRaidersPanel>
          )}
          {step == 2 && <AttackResultPanel onClose={onClose} selectedRaiders={selectedRaiders}></AttackResultPanel>}
          {step == 3 && <StealResultPanel onClose={onClose} selectedRaiders={selectedRaiders}></StealResultPanel>}
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

const AttackResultPanel = ({ selectedRaiders, onClose }: { selectedRaiders: CombatInfo[]; onClose: () => void }) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);

  const { getRealmWatchTower, getEntitiesCombatInfo } = useCombat();

  const watchTowerId = getRealmWatchTower(selectedRaiders[0].locationRealmEntityId);

  const watchTowerHealth = useComponentValue(Health, getEntityIdFromKeys([BigInt(watchTowerId)]));
  const attackerHealth = useComponentValue(Health, getEntityIdFromKeys([BigInt(selectedRaiders[0].entityId)]));

  const watchTower = useMemo(() => {
    const info = watchTowerId ? getEntitiesCombatInfo([watchTowerId]) : undefined;
    if (info?.length === 1) {
      return info[0];
    } else {
      return undefined;
    }
  }, [watchTowerId, watchTowerHealth]);

  return (
    <div className="text-white">
      <div>{"Watchtower Health:"}</div>
      <div>{watchTowerHealth.value}</div>
      <div>{"Attacker Health:"}</div>
      <div>{attackerHealth.value}</div>
      <div className="flex justify-between m-2 text-xxs w-full">
        <div className="flex flex-col items-center justify-center w-full">
          <div className="flex justify-between w-full">
            {!loading && (
              <Button
                className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                onClick={onClose}
                variant="outline"
                withoutSound
              >
                {`Cancel`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StealResultPanel = ({ selectedRaiders, onClose }: { selectedRaiders: CombatInfo[]; onClose: () => void }) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const attackerHealth = useComponentValue(Health, getEntityIdFromKeys([BigInt(selectedRaiders[0].entityId)]));

  return (
    <div className="text-white">
      <div>{"Previous Attacker Health:"}</div>
      <div>{selectedRaiders[0].health}</div>
      <div>{"New Attacker Health:"}</div>
      <div>{attackerHealth.value}</div>
      <div className="flex justify-between m-2 text-xxs w-full">
        <div className="flex flex-col items-center justify-center w-full">
          <div className="flex justify-between w-full">
            {
              <Button
                className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                onClick={onClose}
                variant="outline"
                withoutSound
              >
                {`Cancel`}
              </Button>
            }
          </div>
        </div>
      </div>
    </div>
  );
};

const SelectRaidersPanel = ({
  attackingRaiders,
  selectedRaiders,
  setSelectedRaiders,
  onClose,
  setStep,
}: {
  attackingRaiders: CombatInfo[];
  selectedRaiders: CombatInfo[];
  setSelectedRaiders: (raiders: CombatInfo[]) => void;
  onClose: () => void;
  setStep: (number) => void;
}) => {
  const {
    account: { account },
    setup: {
      components: { Health },
      systemCalls: { attack, steal },
    },
  } = useDojo();

  if (attackingRaiders.length === 0) return null;

  const [loading, setLoading] = useState(false);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { getRealmWatchTower, getEntitiesCombatInfo } = useCombat();

  const [attackerTotalAttack, attackerTotalDefence, _] = useMemo(() => {
    // sum attack of the list
    return [
      selectedRaiders.reduce((acc, battalion) => acc + battalion.attack, 0),
      selectedRaiders.reduce((acc, battalion) => acc + battalion.defence, 0),
      selectedRaiders.reduce((acc, battalion) => acc + battalion.health, 0),
    ];
  }, [selectedRaiders]);

  const watchTowerId =
    attackingRaiders.length > 0 && attackingRaiders[0]?.locationRealmEntityId
      ? getRealmWatchTower(attackingRaiders[0].locationRealmEntityId)
      : undefined;

  const watchTowerHealth = watchTowerId
    ? useComponentValue(Health, getEntityIdFromKeys([BigInt(watchTowerId)]))
    : undefined;

  const watchTower = useMemo(() => {
    const info = watchTowerId ? getEntitiesCombatInfo([watchTowerId]) : undefined;
    if (info?.length === 1) {
      return info[0];
    } else {
      return undefined;
    }
  }, [watchTowerId, watchTowerHealth]);

  const attackSuccessProb = useMemo(() => {
    return calculateCombatSuccess(attackerTotalAttack, watchTower.defence);
  }, [attackerTotalAttack]);

  const stealSuccessProb = useMemo(() => {
    return calculateStealSuccess(attackerTotalAttack, watchTower.defence);
  }, [attackerTotalAttack]);

  // @ts-ignore
  const { realm } = useGetRealm(realmEntityId);

  const onAttack = async () => {
    if (!selectedRaiders[0].entityId) return;
    // set is loading
    setLoading(true);

    // call contract
    await attack({
      signer: account,
      attacker_id: selectedRaiders[0].entityId,
      target_id: watchTower.entityId,
    });
    // when contract finished setloading false
    setLoading(false);
    // attack result = step 2
    setStep(2);
  };

  const onSteal = async () => {
    if (!selectedRaiders[0]?.entityId || !selectedRaiders[0]?.locationRealmEntityId) return;
    // set is loading
    setLoading(true);

    // call contract
    await steal({
      signer: account,
      attacker_id: selectedRaiders[0].entityId,
      target_id: selectedRaiders[0].locationRealmEntityId,
    });
    // when contract finished setloading false
    setLoading(false);
    // steal result = step 3
    setStep(3);
  };

  return (
    <div>
      <div className="flex flex-col items-center p-2">
        {/* {toRealm && <Headline size="big">Build road to {realmsData["features"][toRealm.realmId - 1].name}</Headline>} */}
        <div className={"relative w-full mt-3"}>
          <div className="flex flex-cols justify-center mb-3">
            <Defence className={"mr-2"} watchTower={watchTower}></Defence>
            <div className="ml-2 space-y-2 overflow-y-auto w-[400px]">
              <div className="font-bold text-white text-xs mb-2">Select Raiders</div>
              <SelectRaiders
                attackingRaiders={attackingRaiders}
                selectedRaiders={selectedRaiders}
                setSelectedRaiders={setSelectedRaiders}
              ></SelectRaiders>
            </div>
          </div>

          <div className="flex flex-col p-2 left-2 bottom-2 rounded-[10px] bg-black/60">
            <div className="mb-1 ml-1 italic text-light-pink text-xs">Stats:</div>
            <div className="mb-1 ml-1 italic text-light-pink text-xs flex flex-row justify-start">
              <div>
                <div> Total Raiders Attack: </div>
                <div> {attackerTotalAttack}</div>
                <div> Total Raiders Defence: </div>
                <div> {attackerTotalDefence}</div>
              </div>
              <div>
                <div> Total WatchTower Attack: </div>
                <div> {watchTower.attack || 0}</div>
                <div> Total WatchTower Defence: </div>
                <div> {watchTower.defence || 0}</div>
              </div>
              <div>
                <div> Prob Successful Attack: </div>
                <div> {attackSuccessProb}</div>
                <div> Prob Successful Stealing: </div>
                <div> {stealSuccessProb}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-between p-2 text-xxs w-full">
        <div className="flex flex-col items-center justify-center w-full">
          <div className="flex justify-between w-full">
            {!loading && (
              <Button
                className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                onClick={onClose}
                variant="outline"
                withoutSound
              >
                {`Cancel`}
              </Button>
            )}
            <div className="flex-grow"></div> {/* This will push the remaining buttons to the far right */}
            {!loading && (
              <Button
                className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                disabled={!(selectedRaiders.length > 0)}
                onClick={onSteal}
                variant="outline"
                withoutSound
              >
                {`Steal Resources`}
              </Button>
            )}
            {!loading && (
              <Button
                className="!px-[6px] !py-[2px] text-xxs ml-auto"
                disabled={!(selectedRaiders.length > 0 && watchTower.health > 0)}
                onClick={onAttack}
                variant="outline"
                withoutSound
              >
                {`Attack Realm`}
              </Button>
            )}
            {loading && (
              <Button
                className="!px-[6px] !py-[2px] text-xxs ml-auto"
                onClick={() => {}}
                isLoading={true}
                variant="outline"
                withoutSound
              >
                {}
              </Button>
            )}
          </div>
          {!(selectedRaiders.length > 0) && (
            <div className="text-xxs text-order-giants/70">Select at least 1 Raiders Group</div>
          )}
        </div>
      </div>
    </div>
  );
};
