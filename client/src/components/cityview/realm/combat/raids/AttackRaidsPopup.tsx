import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { divideByPrecision, getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { calculateSuccess } from "../../../../../utils/combat";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { Defence } from "../defence/Defence";
import { useComponentValue } from "@dojoengine/react";
import { SelectRaiders } from "./SelectRaiders";
import { useResources } from "../../../../../hooks/helpers/useResources";
import clsx from "clsx";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { CombatInfo, Resource, findResourceById, resources } from "@bibliothecadao/eternum";
import { getRealmIdByPosition, getRealmNameById } from "../../../../../utils/realms";
import { SmallResource } from "../../SmallResource";
import { LevelIndex, useLevel } from "../../../../../hooks/helpers/useLevel";

type AttackRaidsPopupProps = {
  selectedRaider: CombatInfo;
  onClose: () => void;
};

export const AttackRaidsPopup = ({ selectedRaider, onClose }: AttackRaidsPopupProps) => {
  const { position: attackPosition } = selectedRaider;

  const [step, setStep] = useState<number>(1);
  const [selectedRaiders, setSelectedRaiders] = useState<CombatInfo[]>([]);
  const [targetRealmEntityId, setTargetRealmEntityId] = useState<bigint | null>(null);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { getEntitiesCombatInfo, getRealmRaidersOnPosition, getDefenceOnPosition } = useCombat();
  const { getFoodResources } = useResources();

  const attackingEntities = attackPosition ? getRealmRaidersOnPosition(realmEntityId, attackPosition) : [];

  const attackingRaiders = useMemo(() => {
    return getEntitiesCombatInfo(attackingEntities.map((id) => BigInt(id)));
  }, [attackingEntities]);

  useEffect(() => {
    // This effect runs only when selectedRaider changes.
    // Check if selectedRaider is defined and targetRealmEntityId is not already set.
    if (selectedRaider?.locationRealmEntityId && targetRealmEntityId === null) {
      setTargetRealmEntityId(selectedRaider.locationRealmEntityId);
    }
  }, [selectedRaider]);

  const watchTower = useMemo(() => {
    return attackPosition ? getDefenceOnPosition(attackPosition) : undefined;
  }, [attackPosition]);

  const targetFoodBalance = useMemo(() => {
    if (targetRealmEntityId === null) return [];
    return getFoodResources(targetRealmEntityId);
  }, [targetRealmEntityId]);

  const defendingRealmId = useMemo(() => {
    return attackPosition ? getRealmIdByPosition(attackPosition) : undefined;
  }, [attackPosition]);

  const defendingRealmName = useMemo(() => {
    return defendingRealmId ? getRealmNameById(defendingRealmId) : undefined;
  }, [defendingRealmId]);

  return (
    <SecondaryPopup name="attack">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">
            Attacking {defendingRealmName} (#{defendingRealmId?.toString()}):
          </div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"410px"}>
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
          {watchTower && step == 2 && (
            <AttackResultPanel
              watchTower={watchTower}
              onClose={onClose}
              selectedRaiders={selectedRaiders}
            ></AttackResultPanel>
          )}
          {targetRealmEntityId?.toString() && step == 3 && (
            <StealResultPanel
              targetFoodBalance={targetFoodBalance}
              targetRealmEntityId={targetRealmEntityId}
              onClose={onClose}
              selectedRaiders={selectedRaiders}
            />
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

  const newWatchTowerHealth = watchTower?.entityId
    ? useComponentValue(Health, getEntityIdFromKeys([BigInt(watchTower.entityId)]))
    : undefined;
  const success = newWatchTowerHealth ? newWatchTowerHealth.value !== BigInt(watchTower.health) : false;

  return (
    <div className="flex flex-col items-center w-full">
      {success && newWatchTowerHealth && (
        <>
          <div className="flex w-full items-center">
            <svg width="132" height="12" viewBox="0 0 132 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M131.887 6L129 8.88675L126.113 6L129 3.11325L131.887 6ZM129 6.5L1.23874 6.50001L1.23874 5.50001L129 5.5L129 6.5Z"
                fill="#86C16A"
              />
              <path
                d="M17.5986 1L22.2782 4L28.5547 6.00003L22.2782 8L17.5986 11L11 6.5C11 6.5 7.41876 8 5.95938 8C4.5 8 0.999649 6.00003 0.999649 6.00003C0.999649 6.00003 4.5 4 5.95938 4C7.41876 4 11 5.5 11 5.5L17.5986 1Z"
                fill="#86C16A"
                stroke="#86C16A"
                strokeLinejoin="round"
              />
              <circle cx="17.5" cy="6" r="1.5" fill="#1B1B1B" />
              <circle cx="6" cy="6" r="1" fill="#1B1B1B" />
            </svg>

            <div className="text-[#86C16A] text-xs mx-2 flex-1 text-center">Succesfull attack!</div>
            <svg width="132" height="12" viewBox="0 0 132 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0.113249 6L3 8.88675L5.88675 6L3 3.11325L0.113249 6ZM3 6.5L130.761 6.50001L130.761 5.50001L3 5.5L3 6.5Z"
                fill="#86C16A"
              />
              <path
                d="M114.401 1L109.722 4L103.445 6.00003L109.722 8L114.401 11L121 6.5C121 6.5 124.581 8 126.041 8C127.5 8 131 6.00003 131 6.00003C131 6.00003 127.5 4 126.041 4C124.581 4 121 5.5 121 5.5L114.401 1Z"
                fill="#86C16A"
                stroke="#86C16A"
                strokeLinejoin="round"
              />
              <circle cx="1.5" cy="1.5" r="1.5" transform="matrix(-1 0 0 1 116 4.5)" fill="#1B1B1B" />
              <circle cx="1" cy="1" r="1" transform="matrix(-1 0 0 1 127 5)" fill="#1B1B1B" />
            </svg>
          </div>
          <div className="italic text-light-pink text-xxs my-2">Watch tower was damaged by your raid group!</div>
          <img
            src={`/images/lost_raid.png`}
            className="object-cover  border border-gold w-full h-full rounded-[10px]"
          />
          <div className="flex flex-col mt-2 w-full">
            <div className="text-light-pink text-xs">{"Damage dealt:"}</div>
            <div className="p-2 mb-2 rounded flex bg-black/20 text-white text-xxs space-x-2">
              <div>{"Watchtower Old Health:"}</div>
              <div className="text-order-brilliance">{watchTower.health}</div>
              <div>{"Watchtower New Health:"}</div>
              <div className="text-order-giants">{newWatchTowerHealth.value.toString()}</div>
            </div>
          </div>
        </>
      )}
      {!success && (
        <>
          <div className="flex w-full items-center">
            <svg width="142" height="12" viewBox="0 0 142 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M141.887 6L139 8.88675L136.113 6L139 3.11325L141.887 6ZM139 6.5L1.23874 6.50001L1.23874 5.50001L139 5.5L139 6.5Z"
                fill="#C84444"
              />
              <path
                d="M17.5986 1L22.2782 4L28.5547 6.00003L22.2782 8L17.5986 11L11 6.5C11 6.5 7.41876 8 5.95938 8C4.5 8 0.999649 6.00003 0.999649 6.00003C0.999649 6.00003 4.5 4 5.95938 4C7.41876 4 11 5.5 11 5.5L17.5986 1Z"
                fill="#C84444"
                stroke="#C84444"
                strokeLinejoin="round"
              />
              <circle cx="17.5" cy="6" r="1.5" fill="#1B1B1B" />
              <circle cx="6" cy="6" r="1" fill="#1B1B1B" />
            </svg>
            <div className="text-order-giants text-xs mx-2 flex-1 text-center">Attack failed!</div>
            <svg width="142" height="12" viewBox="0 0 142 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0.113249 6L3 8.88675L5.88675 6L3 3.11325L0.113249 6ZM3 6.5L140.761 6.50001L140.761 5.50001L3 5.5L3 6.5Z"
                fill="#C84444"
              />
              <path
                d="M124.401 1L119.722 4L113.445 6.00003L119.722 8L124.401 11L131 6.5C131 6.5 134.581 8 136.041 8C137.5 8 141 6.00003 141 6.00003C141 6.00003 137.5 4 136.041 4C134.581 4 131 5.5 131 5.5L124.401 1Z"
                fill="#C84444"
                stroke="#C84444"
                strokeLinejoin="round"
              />
              <circle cx="1.5" cy="1.5" r="1.5" transform="matrix(-1 0 0 1 126 4.5)" fill="#1B1B1B" />
              <circle cx="1" cy="1" r="1" transform="matrix(-1 0 0 1 137 5)" fill="#1B1B1B" />
            </svg>
          </div>
          <div className="italic text-light-pink text-xxs my-2">Your raid group was defeated by the defence army.</div>
          <img src={`/images/lost_raid.png`} className="object-cover w-full h-full rounded-[10px]" />
          <div className="flex flex-col mt-2 w-full">
            <div className="text-light-pink text-xs">{"Battle losses:"}</div>
            {selectedRaiders.map((raider, i) => (
              <AttackerHealthChange selectedRaider={raider} key={raider.entityId} />
            ))}
          </div>
        </>
      )}
      <div className="flex justify-center w-full">
        <Button size="xs" onClick={onClose} variant="outline">
          {`Close`}
        </Button>
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

  const newHealth = selectedRaider?.entityId
    ? useComponentValue(Health, getEntityIdFromKeys([BigInt(selectedRaider.entityId)]))
    : undefined;

  return (
    <div className="p-2 mb-2 rounded flex bg-black/20 text-white text-xxs space-x-2">
      <div>{`Group #${selectedRaider.entityId}`}:</div>
      <div>Old Health</div>
      <div className="text-order-brilliance">{selectedRaider.health}</div>
      <div>New Health</div>
      {newHealth && <div className="text-order-giants">{newHealth.value.toString()}</div>}
    </div>
  );
};

const StealResultPanel = ({
  targetFoodBalance,
  targetRealmEntityId,
  selectedRaiders,
  onClose,
}: {
  targetFoodBalance: Resource[];
  targetRealmEntityId: bigint;
  selectedRaiders: CombatInfo[];
  onClose: () => void;
}) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const { getResourcesFromInventory, getFoodResources } = useResources();
  const [step, setStep] = useState(1);
  const attackerHealth = selectedRaiders[0].entityId
    ? useComponentValue(Health, getEntityIdFromKeys([BigInt(selectedRaiders[0].entityId)]))
    : undefined;
  const newFoodBalance = getFoodResources(targetRealmEntityId);

  const burnFood = useMemo(() => {
    return targetFoodBalance.map((resource, index) => {
      return { resourceId: resource.resourceId, burntAmount: resource.amount - newFoodBalance[index].amount };
    });
  }, [newFoodBalance]);

  const inventoryResources = useMemo(() => {
    return selectedRaiders[0].entityId ? getResourcesFromInventory(selectedRaiders[0].entityId) : undefined;
  }, [step === 3]);
  const success = attackerHealth ? attackerHealth.value === BigInt(selectedRaiders[0].health) : undefined;

  return (
    <div className="flex flex-col items-center w-full">
      {success && (
        <>
          <div className="flex w-full items-center">
            <svg width="132" height="12" viewBox="0 0 132 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M131.887 6L129 8.88675L126.113 6L129 3.11325L131.887 6ZM129 6.5L1.23874 6.50001L1.23874 5.50001L129 5.5L129 6.5Z"
                fill="#86C16A"
              />
              <path
                d="M17.5986 1L22.2782 4L28.5547 6.00003L22.2782 8L17.5986 11L11 6.5C11 6.5 7.41876 8 5.95938 8C4.5 8 0.999649 6.00003 0.999649 6.00003C0.999649 6.00003 4.5 4 5.95938 4C7.41876 4 11 5.5 11 5.5L17.5986 1Z"
                fill="#86C16A"
                stroke="#86C16A"
                strokeLinejoin="round"
              />
              <circle cx="17.5" cy="6" r="1.5" fill="#1B1B1B" />
              <circle cx="6" cy="6" r="1" fill="#1B1B1B" />
            </svg>

            <div className="text-[#86C16A] text-xs mx-2 flex-1 text-center">Succesfull pillage!</div>
            <svg width="132" height="12" viewBox="0 0 132 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0.113249 6L3 8.88675L5.88675 6L3 3.11325L0.113249 6ZM3 6.5L130.761 6.50001L130.761 5.50001L3 5.5L3 6.5Z"
                fill="#86C16A"
              />
              <path
                d="M114.401 1L109.722 4L103.445 6.00003L109.722 8L114.401 11L121 6.5C121 6.5 124.581 8 126.041 8C127.5 8 131 6.00003 131 6.00003C131 6.00003 127.5 4 126.041 4C124.581 4 121 5.5 121 5.5L114.401 1Z"
                fill="#86C16A"
                stroke="#86C16A"
                strokeLinejoin="round"
              />
              <circle cx="1.5" cy="1.5" r="1.5" transform="matrix(-1 0 0 1 116 4.5)" fill="#1B1B1B" />
              <circle cx="1" cy="1" r="1" transform="matrix(-1 0 0 1 127 5)" fill="#1B1B1B" />
            </svg>
          </div>
          {step === 1 && <div className="italic text-light-pink text-xxs my-2">You have burnt some food:</div>}
          {step !== 1 && <div className="italic text-light-pink text-xxs my-2">You’ve got a golden chest:</div>}
          {step === 1 && (
            <div className="flex relative">
              <img src={`/images/pillage/pillage1.png`} className="object-cover w-full h-full rounded-[10px]" />
              <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-70 rounded-lg"></div>
              {burnFood && (
                <div className="flex justify-center items-center space-x-1 flex-wrap p-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="text-light-pink text-lg w-full mb-2 text-center italic">Burnt Resources!</div>
                  {burnFood.map(
                    (resource) =>
                      resource && (
                        <div key={resource.resourceId} className="flex flex-col items-center justify-center">
                          <ResourceIcon size="md" resource={findResourceById(resource.resourceId)?.trait || ""} />
                          <div className="text-sm mt-1 text-order-titans">
                            -
                            {Intl.NumberFormat("en-US", {
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }).format(divideByPrecision(Number(resource.burntAmount)) || 0)}
                          </div>
                        </div>
                      ),
                  )}
                </div>
              )}
            </div>
          )}
          {step === 2 && <img src={`/images/chest.png`} className="object-cover w-full h-full rounded-[10px]" />}
          {step === 3 && (
            <div className="flex relative">
              <img src={`/images/opened_chest.png`} className="object-cover w-full h-full rounded-[10px]" />
              {inventoryResources && (
                <div className="flex justify-center items-center space-x-1 flex-wrap p-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="text-light-pink text-lg w-full mb-2 text-center italic">You won!</div>
                  {inventoryResources.resources.map(
                    (resource) =>
                      resource && (
                        <div key={resource.resourceId} className="flex flex-col items-center justify-center">
                          <ResourceIcon size="md" resource={findResourceById(resource.resourceId)?.trait || ""} />
                          <div className="text-sm mt-1 text-order-brilliance">
                            +
                            {Intl.NumberFormat("en-US", {
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }).format(divideByPrecision(Number(resource.amount)) || 0)}
                          </div>
                        </div>
                      ),
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {!success && (
        <>
          <div className="flex w-full items-center">
            <svg width="142" height="12" viewBox="0 0 142 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M141.887 6L139 8.88675L136.113 6L139 3.11325L141.887 6ZM139 6.5L1.23874 6.50001L1.23874 5.50001L139 5.5L139 6.5Z"
                fill="#C84444"
              />
              <path
                d="M17.5986 1L22.2782 4L28.5547 6.00003L22.2782 8L17.5986 11L11 6.5C11 6.5 7.41876 8 5.95938 8C4.5 8 0.999649 6.00003 0.999649 6.00003C0.999649 6.00003 4.5 4 5.95938 4C7.41876 4 11 5.5 11 5.5L17.5986 1Z"
                fill="#C84444"
                stroke="#C84444"
                strokeLinejoin="round"
              />
              <circle cx="17.5" cy="6" r="1.5" fill="#1B1B1B" />
              <circle cx="6" cy="6" r="1" fill="#1B1B1B" />
            </svg>
            <div className="text-order-giants text-xs mx-2 flex-1 text-center">Pillage failed!</div>
            <svg width="142" height="12" viewBox="0 0 142 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0.113249 6L3 8.88675L5.88675 6L3 3.11325L0.113249 6ZM3 6.5L140.761 6.50001L140.761 5.50001L3 5.5L3 6.5Z"
                fill="#C84444"
              />
              <path
                d="M124.401 1L119.722 4L113.445 6.00003L119.722 8L124.401 11L131 6.5C131 6.5 134.581 8 136.041 8C137.5 8 141 6.00003 141 6.00003C141 6.00003 137.5 4 136.041 4C134.581 4 131 5.5 131 5.5L124.401 1Z"
                fill="#C84444"
                stroke="#C84444"
                strokeLinejoin="round"
              />
              <circle cx="1.5" cy="1.5" r="1.5" transform="matrix(-1 0 0 1 126 4.5)" fill="#1B1B1B" />
              <circle cx="1" cy="1" r="1" transform="matrix(-1 0 0 1 137 5)" fill="#1B1B1B" />
            </svg>
          </div>
          <div className="italic text-light-pink text-xxs my-2">
            Your raid group was defeated and sent back to home realm.
          </div>
          <img src={`/images/lost_raid.png`} className="object-cover w-full h-full rounded-[10px]" />
          <div className="flex flex-col mt-2 w-full">
            <div className="text-light-pink text-xs">{"Battle losses:"}</div>
            <AttackerHealthChange selectedRaider={selectedRaiders[0]} />
          </div>
        </>
      )}
      <div className="flex justify-center mt-2 text-xxs w-full">
        <Button
          size="xs"
          onClick={() => {
            if (step === 1) setStep(2);
            else if (success && step === 2) {
              setStep(3);
            } else {
              onClose();
            }
          }}
          variant="outline"
        >
          {step === 1 ? "Steal Resources" : success && step === 2 ? `Open Chest` : "Close"}
        </Button>
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
  setStep: (number: number) => void;
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { attack, steal },
    },
  } = useDojo();

  if (attackingRaiders.length === 0) return null;

  const [loading, setLoading] = useState(false);

  const { realmEntityId, hyperstructureId } = useRealmStore();

  const { getEntityLevel, getRealmLevelBonus } = useLevel();

  const [attackerTotalAttack, attackerTotalHealth] = useMemo(() => {
    // sum attack of the list
    return [
      selectedRaiders.reduce((acc, battalion) => acc + battalion.attack, 0),
      selectedRaiders.reduce((acc, battalion) => acc + battalion.defence, 0),
      selectedRaiders.reduce((acc, battalion) => acc + battalion.health, 0),
    ];
  }, [selectedRaiders]);

  const [attackerLevelBonus, attackerHyperstructureLevelBonus] = useMemo(() => {
    let level = getEntityLevel(realmEntityId)?.level || 0;
    let hyperstructureLevel = hyperstructureId ? getEntityLevel(hyperstructureId)?.level || 0 : 0;
    let levelBonus = getRealmLevelBonus(level, LevelIndex.COMBAT);
    let hyperstructureLevelBonus = getRealmLevelBonus(hyperstructureLevel, LevelIndex.COMBAT);
    return [levelBonus, hyperstructureLevelBonus];
  }, [realmEntityId]);

  const [defenderLevelBonus, defenderHyperstructureLevelBonus] = useMemo(() => {
    if (watchTower) {
      let level = watchTower.entityOwnerId ? getEntityLevel(watchTower.entityOwnerId)?.level || 0 : 0;
      let hyperstructureLevel = watchTower.hyperstructureId
        ? getEntityLevel(watchTower.hyperstructureId)?.level || 0
        : 0;
      let levelBonus = getRealmLevelBonus(level, LevelIndex.COMBAT);
      let hyperstructureLevelBonus = getRealmLevelBonus(hyperstructureLevel, LevelIndex.COMBAT);
      return [levelBonus, hyperstructureLevelBonus];
    } else {
      return [100, 100];
    }
  }, [watchTower]);

  const succesProb = useMemo(() => {
    return calculateSuccess(
      { attack: (attackerTotalAttack * attackerLevelBonus) / 100, health: attackerTotalHealth },
      watchTower
        ? {
            defence: (watchTower.defence * defenderLevelBonus * defenderHyperstructureLevelBonus) / 10000,
            health: watchTower.health,
          }
        : undefined,
    );
  }, [attackerTotalAttack, attackerLevelBonus, defenderLevelBonus, defenderHyperstructureLevelBonus]);

  // @ts-ignore
  const { realm } = useGetRealm(realmEntityId);

  const onAttack = async () => {
    // set is loading
    setLoading(true);

    // call contract
    if (watchTower?.locationRealmEntityId) {
      await attack({
        signer: account,
        attacker_ids: selectedRaiders.map((raider) => Number(raider.entityId)).filter(Boolean) as number[],
        target_id: watchTower.locationRealmEntityId,
      });
      // when contract finished setloading false
      setLoading(false);
      // attack result = step 2
      setStep(2);
    }
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
    <>
      <div className="flex flex-col items-center w-full">
        {/* {toRealm && <Headline size="big">Build road to {realmsData["features"][toRealm.realmId - 1].name}</Headline>} */}
        <div className="p-2 rounded border border-gold w-full flex flex-col">
          {watchTower ? (
            <Defence
              hyperstructureLevelBonus={defenderHyperstructureLevelBonus}
              levelBonus={defenderLevelBonus}
              watchTower={watchTower}
            ></Defence>
          ) : (
            <div className="text-xxs text-gold">No watchtower</div>
          )}
          <div className="flex mt-2 flex-col items-center w-full text-xxs">
            <div className="text-light-pink italic w-full">Available resources:</div>
            <div className="grid grid-cols-12 text-lightest gap-2 w-full mt-1 flex-wrap">
              {resources.map((resource) => (
                <SmallResource
                  resourceId={resource.id}
                  vertical
                  intlFormat
                  hideIfZero
                  entity_id={attackingRaiders[0].locationRealmEntityId}
                />
              ))}
            </div>
          </div>
          <div className="flex my-2 flex-col items-center justify-center w-full">
            <div className={`grid mb-1 grid-cols-${watchTower ? "2" : "1"} gap-2 w-full`}>
              <Button
                className="w-full text-xxs h-[18px]"
                disabled={selectedRaiders.length !== 1}
                onClick={onSteal}
                isLoading={loading}
                variant="primary"
              >
                {`Pillage`}
              </Button>
              {watchTower && (
                <Button
                  className="w-full text-xxs h-[18px]"
                  disabled={!(selectedRaiders.length > 0 && watchTower?.health > 0)}
                  onClick={onAttack}
                  isLoading={loading}
                  variant="outline"
                >
                  {`Attack Realm`}
                </Button>
              )}
            </div>
            {selectedRaiders.length > 0 && (
              <div
                className={clsx(
                  "text-xxs flex justify-around w-full",
                  succesProb > 0.5 ? "text-order-brilliance/70" : "text-order-giants/70",
                )}
              >
                <div className="">{(succesProb * 100).toFixed(0)}% success rate</div>
                {watchTower && <div className="">{(succesProb * 100).toFixed(0)}% success rate</div>}
              </div>
            )}
            {!(selectedRaiders.length > 0) && (
              <div className="text-xxs text-order-giants/70">Select at least 1 Raiders Group</div>
            )}
            {selectedRaiders.length > 0 && selectedRaiders.length !== 1 && (
              <div className="text-xxs text-order-giants/70">Can only steal with 1 Raiders Group</div>
            )}
          </div>
        </div>

        <div className={"relative w-full mt-2"}>
          <div className="font-bold text-center text-white text-xs mb-2">Select Raiders</div>
          <div className="flex flex-row mb-1 text-xs items-center justify-center">
            <span className="mr-1 text-gold">{`Realm Bonus: `}</span>
            <span className="text-order-brilliance">{`+${attackerLevelBonus - 100}%`}</span>
          </div>
          <div className="flex flex-row mb-3 text-xs items-center justify-center">
            <span className="mr-1 text-gold">{`Hyperstructure Bonus: `}</span>
            <span className="text-order-brilliance">{`+${attackerHyperstructureLevelBonus - 100}%`}</span>
          </div>
          <SelectRaiders
            attackingRaiders={attackingRaiders}
            selectedRaiders={selectedRaiders}
            setSelectedRaiders={setSelectedRaiders}
          ></SelectRaiders>
        </div>
        <Button className="!px-[6px] mt-2 !py-[2px] text-xxs mr-auto" onClick={onClose} variant="outline">
          {`Cancel`}
        </Button>
      </div>
    </>
  );
};
