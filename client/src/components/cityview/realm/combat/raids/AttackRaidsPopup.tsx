import { useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { calculateSuccess } from "../../../../../utils/combat";
import { CombatInfo, useCombat } from "../../../../../hooks/helpers/useCombat";
import { Defence } from "../defence/Defence";
import { useComponentValue } from "@dojoengine/react";
import { SelectRaiders } from "./SelectRaiders";

type RoadBuildPopupProps = {
  selectedRaider: CombatInfo;
  onClose: () => void;
};

export const AttackRaidsPopup = ({ selectedRaider, onClose }: RoadBuildPopupProps) => {
  const { position: attackPosition } = selectedRaider;

  const [step, setStep] = useState<number>(1);
  const [selectedRaiders, setSelectedRaiders] = useState([]);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { getEntitiesCombatInfo, getRealmRaidersOnPosition, getDefenceOnPosition } = useCombat();

  const attackingEntities = getRealmRaidersOnPosition(realmEntityId, attackPosition);

  const attackingRaiders = useMemo(() => {
    return getEntitiesCombatInfo(attackingEntities);
  }, [attackingEntities]);

  const watchTower = useMemo(() => {
    return getDefenceOnPosition(attackPosition);
  }, []);

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
              watchTower={watchTower}
              setStep={setStep}
              onClose={onClose}
              attackingRaiders={attackingRaiders}
              selectedRaiders={selectedRaiders}
              setSelectedRaiders={setSelectedRaiders}
            ></SelectRaidersPanel>
          )}
          {step == 2 && (
            <AttackResultPanel
              watchTower={watchTower}
              onClose={onClose}
              selectedRaiders={selectedRaiders}
            ></AttackResultPanel>
          )}
          {step == 3 && (
            <StealResultPanel
              watchTower={watchTower}
              onClose={onClose}
              selectedRaiders={selectedRaiders}
            ></StealResultPanel>
          )}
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

const AttackResultPanel = ({
  watchTower,
  selectedRaiders,
  onClose,
}: {
  watchTower: CombatInfo;
  selectedRaiders: CombatInfo[];
  onClose: () => void;
}) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const newWatchTowerHealth = useComponentValue(Health, getEntityIdFromKeys([BigInt(watchTower.entityId)]));
  const success = newWatchTowerHealth.value !== watchTower.health;

  return (
    <div className="text-white">
      <div>{"------ WORK IN PROGRESS ------"}</div>
      {success && (
        <div>
          <div>Success!!!</div>
          <div>{"Watchtower Health:"}</div>
          <div>{"Watchtower Old Health:"}</div>
          <div>{watchTower.health}</div>
          <div>{"Watchtower New Health:"}</div>
          <div>{newWatchTowerHealth.value}</div>
        </div>
      )}
      {!success && (
        <div>
          <div>Failed !!!</div>
          <div>{"Attacker Health:"}</div>
          {selectedRaiders.map((raider, i) => (
            <AttackerHealthChange selectedRaider={raider} key={raider.entityId} />
          ))}
        </div>
      )}
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

const AttackerHealthChange = ({ selectedRaider }: { selectedRaider: CombatInfo }) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const newHealth = useComponentValue(Health, getEntityIdFromKeys([BigInt(selectedRaider.entityId)]));

  return (
    <div>
      <div>{`Raider #${selectedRaider.entityId}`}</div>
      <div>Old Health</div>
      <div>{selectedRaider.health}</div>
      <div>New Health</div>
      <div>{newHealth.value}</div>
    </div>
  );
};

const StealResultPanel = ({
  watchTower,
  selectedRaiders,
  onClose,
}: {
  watchTower: CombatInfo;
  selectedRaiders: CombatInfo[];
  onClose: () => void;
}) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const attackerHealth = useComponentValue(Health, getEntityIdFromKeys([BigInt(selectedRaiders[0].entityId)]));

  const success = attackerHealth.value === selectedRaiders[0].health;

  return (
    <div className="text-white">
      <div>{"------ WORK IN PROGRESS ------"}</div>
      {success && <div>Success!!!</div>}
      {!success && (
        <div>
          <div>Failed!!!</div>
          <div>{"Previous Attacker Health:"}</div>
          <div>{selectedRaiders[0].health}</div>
          <div>{"New Attacker Health:"}</div>
          <div>{attackerHealth.value}</div>
        </div>
      )}
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
  watchTower,
  attackingRaiders,
  selectedRaiders,
  setSelectedRaiders,
  onClose,
  setStep,
}: {
  watchTower: CombatInfo | undefined;
  attackingRaiders: CombatInfo[];
  selectedRaiders: CombatInfo[];
  setSelectedRaiders: (raiders: CombatInfo[]) => void;
  onClose: () => void;
  setStep: (number) => void;
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { attack, steal },
    },
  } = useDojo();

  if (attackingRaiders.length === 0) return null;

  const [loading, setLoading] = useState(false);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const [attackerTotalAttack, attackerTotalDefence, attackerTotalHealth] = useMemo(() => {
    // sum attack of the list
    return [
      selectedRaiders.reduce((acc, battalion) => acc + battalion.attack, 0),
      selectedRaiders.reduce((acc, battalion) => acc + battalion.defence, 0),
      selectedRaiders.reduce((acc, battalion) => acc + battalion.health, 0),
    ];
  }, [selectedRaiders]);

  const succesProb = useMemo(() => {
    return calculateSuccess(
      { attack: attackerTotalAttack, health: attackerTotalHealth },
      watchTower ? { defence: watchTower.defence, health: watchTower.health } : undefined,
    );
  }, [attackerTotalAttack]);

  // @ts-ignore
  const { realm } = useGetRealm(realmEntityId);

  const onAttack = async () => {
    // set is loading
    setLoading(true);

    // call contract
    await attack({
      signer: account,
      attacker_ids: selectedRaiders.map((raider) => raider.entityId),
      target_id: watchTower.locationRealmEntityId,
    });
    // when contract finished setloading false
    setLoading(false);
    // attack result = step 2
    setStep(2);
  };

  const onSteal = async () => {
    // only 1 raider can steal at a time
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
            {watchTower && <Defence className={"mr-2"} watchTower={watchTower}></Defence>}
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
                <div> {watchTower?.attack || 0}</div>
                <div> Total WatchTower Defence: </div>
                <div> {watchTower?.defence || 0}</div>
              </div>
              <div className="ml-10">
                <div> Prob Success: </div>
                <div> {succesProb}</div>
                {/* <div> Formula: </div>
                <div>
                  {
                    "(Attacker Attack * Attacker Health) / (Attacker Attack * Attacker Health + Defender Defence * Defender Health)"
                  }
                </div> */}
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
                disabled={selectedRaiders.length !== 1}
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
                disabled={!(selectedRaiders.length > 0 && watchTower?.health > 0)}
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
          {selectedRaiders.length > 0 && selectedRaiders.length !== 1 && (
            <div className="text-xxs text-order-giants/70">Can only steal with 1 Raiders Group</div>
          )}
        </div>
      </div>
    </div>
  );
};
