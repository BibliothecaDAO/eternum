import { useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { divideByPrecision, getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm, useRealm } from "../../../../../hooks/helpers/useRealm";
import { calculateSuccess } from "../../../../../utils/combat";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { Defence } from "../defence/Defence";
import { useComponentValue } from "@dojoengine/react";
import { SelectRaiders } from "./SelectRaiders";
import { useResources } from "../../../../../hooks/helpers/useResources";
import clsx from "clsx";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { CombatInfo, Position, Resource, findResourceById, resources } from "@bibliothecadao/eternum";
import { getRealmNameById } from "../../../../../utils/realms";
import { SmallResource } from "../../SmallResource";
import { LevelIndex, useLevel } from "../../../../../hooks/helpers/useLevel";
import { useHyperstructure } from "../../../../../hooks/helpers/useHyperstructure";
import useUIStore from "../../../../../hooks/store/useUIStore";

type AttackRaidsPopupProps = {
  attackPosition: Position;
  targetEntityId: bigint;
  onClose: () => void;
};

export const AttackRaidsPopup = ({ attackPosition, targetEntityId, onClose }: AttackRaidsPopupProps) => {
  const { getEntitiesCombatInfo, getOwnerRaidersOnPosition, getDefenceOnPosition } = useCombat();
  const { isEntityIdRealm } = useRealm();

  const isTargetRealm = isEntityIdRealm(targetEntityId);

  const [step, setStep] = useState<number>(1);
  const [selectedRaiders, setSelectedRaiders] = useState<CombatInfo[]>([]);

  const { getFoodResources } = useResources();

  const attackingEntities = attackPosition ? getOwnerRaidersOnPosition(attackPosition) : [];
  const attackingRaiders = useMemo(() => {
    return getEntitiesCombatInfo(attackingEntities.map((id) => BigInt(id)));
  }, [attackingEntities]);

  const targetCombatInfo = useMemo(() => {
    if (!isTargetRealm) {
      return getEntitiesCombatInfo([targetEntityId])[0];
    }
    return getDefenceOnPosition(attackPosition);
  }, [attackPosition]);

  const targetFoodBalance = useMemo(() => {
    if (targetEntityId === null) return [];
    return getFoodResources(targetEntityId);
  }, [targetEntityId]);

  const targetRealmName = useMemo(() => {
    return targetCombatInfo?.originRealmId ? getRealmNameById(targetCombatInfo.originRealmId) : undefined;
  }, [targetCombatInfo]);

  const popUpHeader = useMemo(() => {
    if (!isTargetRealm) {
      return `Attacking Raider #${targetCombatInfo?.entityId} from ${targetRealmName}`;
    } else {
      return `Attacking ${targetRealmName}`;
    }
  }, [targetCombatInfo]);

  const renderStepConstent = () => {
    switch (step) {
      case 1:
        return (
          <SelectRaidersPanel
            defence={targetCombatInfo}
            isTargetRealm={isTargetRealm}
            setStep={setStep}
            onClose={onClose}
            attackingRaiders={attackingRaiders}
            selectedRaiders={selectedRaiders}
            setSelectedRaiders={setSelectedRaiders}
          ></SelectRaidersPanel>
        );
      case 2:
        return (
          <>
            {targetCombatInfo && (
              <AttackResultPanel
                defence={targetCombatInfo}
                selectedRaiders={selectedRaiders}
                onClose={onClose}
              ></AttackResultPanel>
            )}
          </>
        );
      case 3:
        return (
          <StealResultPanel
            targetFoodBalance={targetFoodBalance}
            targetEntityId={targetEntityId}
            onClose={onClose}
            selectedRaiders={selectedRaiders}
          ></StealResultPanel>
        );
      default:
        return null;
    }
  };

  return (
    <SecondaryPopup name="attack">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">{popUpHeader}</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"410px"}>
        <div className="flex flex-col items-center p-2">{renderStepConstent()}</div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

const AttackResultPanel = ({
  defence,
  selectedRaiders,
  onClose,
}: {
  defence: CombatInfo;
  selectedRaiders: CombatInfo[];
  onClose: () => void;
}) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const newWatchTowerHealth = defence?.entityId
    ? useComponentValue(Health, getEntityIdFromKeys([BigInt(defence.entityId)]))
    : undefined;
  const success = newWatchTowerHealth ? newWatchTowerHealth.value !== BigInt(defence.health) : false;

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
          <div className="italic text-light-pink text-xxs my-2">Enemy was damaged by your raid group!</div>
          <img
            src={`/images/lost_raid.png`}
            className="object-cover  border border-gold w-full h-full rounded-[10px]"
          />
          <div className="flex flex-col mt-2 w-full">
            <div className="text-light-pink text-xs">{"Damage dealt:"}</div>
            <div className="p-2 mb-2 rounded flex bg-black/20 text-white text-xxs space-x-2">
              <div>{"Old Health:"}</div>
              <div className="text-order-brilliance">{defence.health}</div>
              <div>{"New Health:"}</div>
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
            {selectedRaiders.map((raider) => (
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
  targetEntityId,
  selectedRaiders,
  onClose,
}: {
  targetFoodBalance: Resource[];
  targetEntityId: bigint;
  selectedRaiders: CombatInfo[];
  onClose: () => void;
}) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const { getResourcesFromInventory, getFoodResources } = useResources();
  const attackerHealth = selectedRaiders[0].entityId
    ? useComponentValue(Health, getEntityIdFromKeys([BigInt(selectedRaiders[0].entityId)]))
    : undefined;
  const newFoodBalance = getFoodResources(targetEntityId);

  const burnFood = useMemo(() => {
    return targetFoodBalance.map((resource, index) => {
      return { resourceId: resource.resourceId, burntAmount: resource.amount - newFoodBalance[index].amount };
    });
  }, [newFoodBalance]);

  // Determine if all burnt amounts are 0 to adjust the initial step.
  const initialStep = useMemo(() => {
    return burnFood.every((burnt) => burnt.burntAmount === 0) ? 2 : 1;
  }, [burnFood]);

  const [step, setStep] = useState(initialStep);

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
  defence,
  isTargetRealm,
  attackingRaiders,
  selectedRaiders,
  setSelectedRaiders,
  onClose,
  setStep,
}: {
  defence: CombatInfo | undefined;
  isTargetRealm: boolean;
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

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const conqueredHyperstructureNumber = useUIStore((state) => state.conqueredHyperstructureNumber);

  const { getEntityLevel, getRealmLevelBonus } = useLevel();
  const { getConqueredHyperstructures } = useHyperstructure();
  const { getBalance, getResourcesFromInventory } = useResources();

  const [attackerTotalAttack, attackerTotalHealth] = useMemo(() => {
    // sum attack of the list
    return [
      selectedRaiders.reduce((acc, battalion) => acc + battalion.attack, 0),
      selectedRaiders.reduce((acc, battalion) => acc + battalion.defence, 0),
      selectedRaiders.reduce((acc, battalion) => acc + battalion.health, 0),
    ];
  }, [selectedRaiders]);

  const hasWatchTower = defence && defence.health > 0;

  const [attackerLevelBonus, attackerHyperstructureLevelBonus] = useMemo(() => {
    let level = getEntityLevel(realmEntityId)?.level || 0;
    let levelBonus = getRealmLevelBonus(level, LevelIndex.COMBAT);
    return [levelBonus, conqueredHyperstructureNumber * 25 + 100];
  }, [realmEntityId]);

  const conqueredHyperstructures = useMemo(() => {
    if (defence) {
      return getConqueredHyperstructures(defence.order).length;
    } else {
      return 0;
    }
  }, []);

  const [defenderLevelBonus, defenderHyperstructureLevelBonus] = useMemo(() => {
    if (defence) {
      let level = defence.entityOwnerId ? getEntityLevel(defence.entityOwnerId)?.level || 0 : 0;
      let levelBonus = getRealmLevelBonus(level, LevelIndex.COMBAT);
      let hyperstructureLevelBonus = conqueredHyperstructures * 25 + 100;
      return [levelBonus, hyperstructureLevelBonus];
    } else {
      return [100, 100];
    }
  }, [defence, conqueredHyperstructures]);

  const succesProb = useMemo(() => {
    return calculateSuccess(
      {
        attack: attackerTotalAttack * (attackerLevelBonus / 100) * (attackerHyperstructureLevelBonus / 100),
        health: attackerTotalHealth,
      },
      defence
        ? {
            defence: defence.defence * (defenderLevelBonus / 100) * (defenderHyperstructureLevelBonus / 100),
            health: defence.health,
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
    if (defence?.entityId) {
      await attack({
        signer: account,
        attacker_ids: selectedRaiders.map((raider) => Number(raider.entityId)).filter(Boolean) as number[],
        target_id: defence.entityId,
      });
      // when contract finished setloading false
      setLoading(false);
      // attack result = step 2
      setStep(2);
    }
  };

  const onSteal = async () => {
    // only 1 raider can steal at a time

    if (!selectedRaiders[0]?.entityId) return;

    setLoading(true);

    // call contract
    await steal({
      signer: account,
      attacker_id: selectedRaiders[0].entityId,
      target_id: defence!.entityId,
    });
    // when contract finished setloading false
    setLoading(false);
    // steal result = step 3
    setStep(3);
  };

  const [resoureBalances, hasResources] = useMemo(() => {
    let resourceBalances: { resourceId: number; balance: number }[] = [];
    let hasResources = false;
    if (isTargetRealm) {
      if (defence?.locationEntityId) {
        for (const resource of resources) {
          const balance = getBalance(defence?.locationEntityId, resource.id);
          if (balance && balance.balance > 0) {
            hasResources = true;
            resourceBalances.push({ resourceId: balance.resource_type, balance: balance.balance });
          }
        }
      }
      if (defence?.entityId) {
        let resources = getResourcesFromInventory(defence.entityId).resources;
        for (const resource of resources) {
          if (resource.amount > 0) {
            hasResources = true;
            resourceBalances.push({ resourceId: resource.resourceId, balance: resource.amount });
          }
        }
      }
    } else {
      const inventoryResources = getResourcesFromInventory(defence!.entityId);
      resourceBalances = inventoryResources.resources.map(({ amount, resourceId }) => {
        return { balance: amount, resourceId };
      });
      if (resourceBalances.length > 0) hasResources = true;
    }
    return [resourceBalances, hasResources];
  }, []);
  return (
    <>
      <div className="flex flex-col items-center w-full">
        <div className="p-2 rounded border border-gold w-full flex flex-col">
          {hasWatchTower ? (
            <Defence
              conqueredHyperstructures={conqueredHyperstructures}
              levelBonus={defenderLevelBonus}
              watchTower={defence}
              isWatchTower={isTargetRealm}
            ></Defence>
          ) : (
            <div className="text-xxs text-gold">No Defences</div>
          )}
          <div className="flex mt-2 flex-col items-center w-full text-xxs">
            <div className="text-light-pink italic w-full">{`${
              hasResources ? "Available resources:" : "Defender does not own any resource"
            }`}</div>
            <div className="grid grid-cols-12 text-lightest gap-2 w-full mt-1 flex-wrap">
              {resoureBalances.map((resource) => (
                <SmallResource
                  resourceId={resource.resourceId}
                  balance={resource.balance}
                  vertical
                  intlFormat
                  hideIfZero
                />
              ))}
            </div>
          </div>
          <div className="flex my-2 flex-col items-center justify-center w-full">
            {!hasResources && (
              <div className="text-xxs text-order-giants/70 mb-3">
                Cannot pillage if there are no resources to steal
              </div>
            )}
            {selectedRaiders.length > 0 && selectedRaiders.length !== 1 && (
              <div className="text-xxs text-order-giants/70">Can only pillage with 1 Raiders Group</div>
            )}
            <div className={`grid mb-1 grid-cols-${hasWatchTower ? "2" : "1"} gap-2 w-full`}>
              <div>
                <Button
                  className="w-full text-xxs h-[18px]"
                  disabled={selectedRaiders.length !== 1 || !hasResources}
                  onClick={onSteal}
                  isLoading={loading}
                  variant="primary"
                >
                  {`Pillage`}
                </Button>
                {selectedRaiders.length == 1 && (
                  <div
                    className={clsx(
                      "text-xxs flex justify-around w-full",
                      succesProb > 0.5 ? "text-order-brilliance/70" : "text-order-giants/70",
                    )}
                  >
                    {(succesProb * 100).toFixed(0)}% success rate
                  </div>
                )}
              </div>
              {hasWatchTower && (
                <div>
                  <Button
                    className="w-full text-xxs h-[18px]"
                    disabled={!(selectedRaiders.length > 0 && defence?.health > 0)}
                    onClick={onAttack}
                    isLoading={loading}
                    variant="outline"
                  >
                    {`Attack`}
                  </Button>
                  {selectedRaiders.length > 0 && (
                    <div
                      className={clsx(
                        "text-xxs flex justify-around w-full",
                        succesProb > 0.5 ? "text-order-brilliance/70" : "text-order-giants/70",
                      )}
                    >
                      {(succesProb * 100).toFixed(0)}% success rate
                    </div>
                  )}
                </div>
              )}
            </div>

            {!(selectedRaiders.length > 0) && (
              <div className="text-xxs text-order-giants/70">Select at least 1 Raiders Group</div>
            )}
          </div>
          {/* // note: add more combat info once combat system is more mature */}
          {/* <div className="flex w-full">
            <Equation className="text-white h-6"></Equation>
          </div> */}
        </div>

        <div className={"relative w-full mt-2"}>
          <div className="font-bold text-center text-white text-xs mb-2">Select Raiders</div>
          <div className="flex flex-row mb-1 text-xs items-center justify-center">
            <span className="mr-1 text-gold">{`Realm Bonus: `}</span>
            <span className="text-order-brilliance">{`+${attackerLevelBonus - 100}%`}</span>
          </div>
          <div className="flex flex-row mb-3 text-xs items-center justify-center">
            {/* <span className="mr-1 text-gold">{`Hyperstructure Bonus: `}</span> */}
            {/* <span className="text-order-brilliance">{`+${attackerHyperstructureLevelBonus - 100}%`}</span> */}
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
