import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { Headline } from "../../../../elements/Headline";
import { ResourceCost } from "../../../../elements/ResourceCost";
import { NumberInput } from "../../../../elements/NumberInput";
import { CaravanInterface, ResourcesIds, ONE_MONTH, WEIGHTS, resources } from "@bibliothecadao/eternum";
import { ReactComponent as Danger } from "../../../../assets/icons/common/danger.svg";
import { ReactComponent as Donkey } from "../../../../assets/icons/units/donkey-circle.svg";
import { Caravan } from "./Caravans/Caravan";
import { useDojo } from "../../../../DojoContext";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { useCaravan } from "../../../../hooks/helpers/useCaravans";
import { divideByPrecision, multiplyByPrecision } from "../../../../utils/utils";
import { useGetRealm } from "../../../../hooks/helpers/useRealm";
import clsx from "clsx";
import { DONKEYS_PER_CITY, WEIGHT_PER_DONKEY_KG } from "@bibliothecadao/eternum";
import { useResources } from "../../../../hooks/helpers/useResources";
import ListSelect from "../../../../elements/ListSelect";
import { getTotalResourceWeight } from "./utils";

type FastCreateOfferPopupProps = {
  resourceId: number;
  isBuy: boolean;
  resourcesListEditDisabled?: boolean;
  onClose: () => void;
  onCreate: () => void;
};

export const FastCreateOfferPopup = ({
  resourceId,
  isBuy,
  onClose,
  resourcesListEditDisabled,
}: FastCreateOfferPopupProps) => {
  const [selectedResourceIdsGive, setSelectedResourceIdsGive] = useState<number[]>([]);
  const [selectedResourceIdsGet, setSelectedResourceIdsGet] = useState<number[]>([]);
  const [selectedResourcesGiveAmounts, setSelectedResourcesGiveAmounts] = useState<{ [key: number]: number }>({});
  const [selectedResourcesGetAmounts, setSelectedResourcesGetAmounts] = useState<{ [key: number]: number }>({});
  const [selectedCaravan, setSelectedCaravan] = useState<bigint>(0n);
  const [selectedRealmId, setSelectedRealmId] = useState<number | undefined>();
  const [isNewCaravan, setIsNewCaravan] = useState(true);
  const [donkeysCount, setDonkeysCount] = useState(1);
  const [resourceWeight, setResourceWeight] = useState(0);
  const [hasEnoughDonkeys, setHasEnoughDonkeys] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    account: { account },
    setup: {
      optimisticSystemCalls: { optimisticCreateOrder },
      systemCalls: { create_order },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  useEffect(() => {
    if (isBuy) {
      setSelectedResourceIdsGive([ResourcesIds.Lords]);
      setSelectedResourceIdsGet([resourceId]);
      setSelectedResourcesGiveAmounts({ [ResourcesIds.Lords]: 1 });
      setSelectedResourcesGetAmounts({ [resourceId]: 1 });
    } else {
      setSelectedResourceIdsGive([resourceId]);
      setSelectedResourceIdsGet([ResourcesIds.Lords]);
      setSelectedResourcesGiveAmounts({ [resourceId]: 1 });
      setSelectedResourcesGetAmounts({ [ResourcesIds.Lords]: 1 });
    }
  }, [resourceId, isBuy]);

  const createOrder = async () => {
    setIsLoading(true);
    if (!nextBlockTimestamp) return;
    if (isNewCaravan) {
      await optimisticCreateOrder(create_order)({
        signer: account,
        maker_id: realmEntityId,
        maker_gives_resource_types: selectedResourceIdsGive,
        maker_gives_resource_amounts: selectedResourceIdsGive.map((id) =>
          multiplyByPrecision(selectedResourcesGiveAmounts[id]),
        ),
        taker_id: 0,
        taker_gives_resource_types: selectedResourceIdsGet,
        taker_gives_resource_amounts: selectedResourceIdsGet.map((id) =>
          multiplyByPrecision(selectedResourcesGetAmounts[id]),
        ),
        donkeys_quantity: donkeysCount,
        expires_at: nextBlockTimestamp + ONE_MONTH,
      });
    } else {
      await optimisticCreateOrder(create_order)({
        signer: account,
        maker_id: realmEntityId,
        maker_gives_resource_types: selectedResourceIdsGive,
        maker_gives_resource_amounts: selectedResourceIdsGive.map((id) =>
          multiplyByPrecision(selectedResourcesGiveAmounts[id]),
        ),
        taker_id: 0,
        maker_transport_id: selectedCaravan,
        taker_gives_resource_types: selectedResourceIdsGet,
        taker_gives_resource_amounts: selectedResourceIdsGet.map((id) =>
          multiplyByPrecision(selectedResourcesGetAmounts[id]),
        ),
        expires_at: nextBlockTimestamp + ONE_MONTH,
      });
    }
    onClose();
  };

  const canCreateOffer = useMemo(() => {
    return selectedCaravan !== 0n || (hasEnoughDonkeys && isNewCaravan);
  }, [selectedCaravan, hasEnoughDonkeys, isNewCaravan]);

  useEffect(() => {
    setHasEnoughDonkeys(multiplyByPrecision(donkeysCount * WEIGHT_PER_DONKEY_KG) >= resourceWeight);
  }, [donkeysCount, resourceWeight]);

  return (
    <SecondaryPopup name="create-offer">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Create Offer:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"550px"}>
        <div className="flex flex-col items-center p-2">
          <SelectResourcesAmountPanel
            selectedResourceIdsGive={selectedResourceIdsGive}
            selectedResourcesGiveAmounts={selectedResourcesGiveAmounts}
            setSelectedResourceIdsGive={setSelectedResourceIdsGive}
            setSelectedResourcesGiveAmounts={setSelectedResourcesGiveAmounts}
            resourceWeight={resourceWeight}
            selectedResourceIdsGet={selectedResourceIdsGet}
            selectedResourcesGetAmounts={selectedResourcesGetAmounts}
            setSelectedResourceIdsGet={setSelectedResourceIdsGet}
            setSelectedResourcesGetAmounts={setSelectedResourcesGetAmounts}
            setResourceWeight={setResourceWeight}
            selectedRealmId={selectedRealmId}
            setSelectedRealmId={setSelectedRealmId}
            resourcesListEditDisabled={resourcesListEditDisabled}
          />

          <SelectCaravanPanel
            donkeysCount={donkeysCount}
            setDonkeysCount={setDonkeysCount}
            isNewCaravan={isNewCaravan}
            setIsNewCaravan={setIsNewCaravan}
            selectedCaravan={selectedCaravan}
            setSelectedCaravan={setSelectedCaravan}
            selectedResourceIdsGet={selectedResourceIdsGet}
            selectedResourcesGetAmounts={selectedResourcesGetAmounts}
            selectedResourceIdsGive={selectedResourceIdsGive}
            selectedResourcesGiveAmounts={selectedResourcesGiveAmounts}
            resourceWeight={resourceWeight}
            hasEnoughDonkeys={hasEnoughDonkeys}
          />
        </div>
        <div className="flex justify-between m-2 text-xxs">
          <Button
            className="!px-[6px] !py-[2px] w-full"
            disabled={!canCreateOffer}
            isLoading={isLoading}
            onClick={() => {
              createOrder();
            }}
            size="md"
            variant={"primary"}
          >
            Create Order
          </Button>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

const SelectResourcesAmountPanel = ({
  selectedResourceIdsGive,
  selectedResourceIdsGet,
  selectedResourcesGiveAmounts,
  selectedResourcesGetAmounts,
  resourceWeight,
  setSelectedResourceIdsGive,
  setSelectedResourceIdsGet,
  setSelectedResourcesGiveAmounts,
  setSelectedResourcesGetAmounts,
  setResourceWeight,
  resourcesListEditDisabled,
}: {
  selectedResourceIdsGive: number[];
  selectedResourceIdsGet: number[];
  selectedResourcesGiveAmounts: { [key: number]: number };
  selectedResourcesGetAmounts: { [key: number]: number };
  resourceWeight: number;
  setSelectedResourceIdsGive: (selectedResourceIdsGive: number[]) => void;
  setSelectedResourceIdsGet: (selectedResourceIdsGet: number[]) => void;
  setSelectedResourcesGiveAmounts: (selectedResourcesGiveAmounts: { [key: number]: number }) => void;
  setSelectedResourcesGetAmounts: (selectedResourcesGetAmounts: { [key: number]: number }) => void;
  setResourceWeight: (resourceWeight: number) => void;
  selectedRealmId: number | undefined;
  setSelectedRealmId: (selectedRealmId: number) => void;
  resourcesListEditDisabled?: boolean;
}) => {
  const { realmEntityId } = useRealmStore();

  const { getBalance } = useResources();

  const swapResources = () => {
    const tmpGet = [...selectedResourceIdsGet];
    const tmpGive = [...selectedResourceIdsGive];
    const tmpGetAmounts = { ...selectedResourcesGetAmounts };
    const tmpGiveAmounts = { ...selectedResourcesGiveAmounts };
    setSelectedResourceIdsGive(tmpGet);
    setSelectedResourceIdsGet(tmpGive);
    setSelectedResourcesGiveAmounts(tmpGetAmounts);
    setSelectedResourcesGetAmounts(tmpGiveAmounts);
  };

  const unselectedResources = useMemo(
    () =>
      resources.filter((res) => !selectedResourceIdsGive.includes(res.id) && !selectedResourceIdsGet.includes(res.id)),
    [selectedResourceIdsGive, selectedResourceIdsGet],
  );

  const addResourceGive = () => {
    setSelectedResourceIdsGive([...selectedResourceIdsGive, unselectedResources[0].id]);
    setSelectedResourcesGiveAmounts({
      ...selectedResourcesGiveAmounts,
      [unselectedResources[0].id]: 1,
    });
  };

  const addResourceGet = () => {
    setSelectedResourceIdsGet([...selectedResourceIdsGet, unselectedResources[0].id]);
    setSelectedResourcesGetAmounts({
      ...selectedResourcesGetAmounts,
      [unselectedResources[0].id]: 1,
    });
  };

  useEffect(() => {
    // set resource weight in kg
    let resourcesGet = Object.keys(selectedResourcesGetAmounts).map((resourceId) => {
      return {
        resourceId: Number(resourceId),
        amount: selectedResourcesGetAmounts[Number(resourceId)],
      };
    });
    setResourceWeight(multiplyByPrecision(getTotalResourceWeight(resourcesGet)));
  }, [selectedResourcesGetAmounts]);

  return (
    <>
      <div className="grid w-full grid-cols-9 gap-2 p-2 max-h-[250px] overflow-y-auto overflow-x-hidden relative">
        <div className="flex flex-col items-center col-span-4 space-y-2">
          <Headline className="mb-2">You Sell</Headline>
          {selectedResourceIdsGive.map((id, index) => {
            let resource = getBalance(realmEntityId, id);
            let options = [resources.find((res) => res.id === id), ...unselectedResources] as any;
            options = options.map((res: any) => {
              const bal = getBalance(realmEntityId, res.id);
              return {
                id: res.id,
                label: (
                  <ResourceCost
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedResourcesGiveAmounts({
                        ...selectedResourcesGiveAmounts,
                        [id]: divideByPrecision(bal?.balance || 0),
                      });
                    }}
                    resourceId={res.id}
                    amount={divideByPrecision(bal?.balance || 0)}
                  />
                ),
              };
            });
            if (selectedResourceIdsGive.length > 1) {
              options = [
                {
                  id: 0,
                  label: (
                    <div className="flex items-center justify-center">
                      <div className="ml-1 text-danger">Remove item</div>
                    </div>
                  ),
                },
                ...options,
              ];
            }
            return (
              <div key={id} className="flex items-center w-full">
                <NumberInput
                  max={divideByPrecision(resource?.balance || 0)}
                  min={1}
                  value={selectedResourcesGiveAmounts[id]}
                  onChange={(value) => {
                    setSelectedResourcesGiveAmounts({
                      ...selectedResourcesGiveAmounts,
                      [id]: Math.min(divideByPrecision(resource?.balance || 0), value),
                    });
                  }}
                />
                {!resourcesListEditDisabled ? (
                  <ListSelect
                    className="w-full ml-2"
                    style="black"
                    options={options}
                    value={selectedResourceIdsGive[index]}
                    onChange={(value) => {
                      if (value === 0) {
                        const tmp = [...selectedResourceIdsGive];
                        tmp.splice(index, 1);
                        setSelectedResourceIdsGive(tmp);
                        const tmpAmounts = { ...selectedResourcesGiveAmounts };
                        delete tmpAmounts[id];
                        setSelectedResourcesGiveAmounts(tmpAmounts);
                        return;
                      }
                      const tmp = [...selectedResourceIdsGive];
                      tmp[index] = value;
                      setSelectedResourceIdsGive(tmp);
                      setSelectedResourcesGiveAmounts({
                        ...selectedResourcesGiveAmounts,
                        [value]: 1,
                      });
                    }}
                  />
                ) : (
                  <ResourceCost className="ml-2" resourceId={id} amount={divideByPrecision(resource?.balance || 0)} />
                )}
              </div>
            );
          })}
          {!resourcesListEditDisabled && (
            <Button className="w-full" variant="primary" size="md" onClick={() => addResourceGive()}>
              Add Resource
            </Button>
          )}
        </div>
        <div className="flex items-center justify-center">
          <div className="sticky top-1/2 -translate-y-1/2" onClick={() => swapResources()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M17.1827 20.0928C18.148 20.0928 18.8871 19.8394 19.4 19.3326C19.9068 18.8318 20.1602 18.0987 20.1602 17.1334V6.76207C20.1602 5.80277 19.9068 5.07274 19.4 4.57197C18.8871 4.06517 18.148 3.81177 17.1827 3.81177H6.84758C5.88224 3.81177 5.14617 4.06517 4.63937 4.57197C4.13257 5.07877 3.87917 5.8088 3.87917 6.76207V17.1334C3.87917 18.0927 4.13257 18.8257 4.63937 19.3326C5.14617 19.8394 5.88224 20.0928 6.84758 20.0928H17.1827Z"
                fill="white"
              />
              <path
                d="M16.6089 12.5008C16.7824 12.3402 16.8691 12.1493 16.8691 11.928C16.8691 11.7154 16.7824 11.5288 16.6089 11.3683L14.41 9.24002C14.2798 9.11418 14.1259 9.05127 13.948 9.05127C13.7746 9.05127 13.6336 9.10985 13.5252 9.227C13.4124 9.33981 13.356 9.48517 13.356 9.66307C13.356 9.8453 13.4232 9.99717 13.5577 10.1187L14.2863 10.8021L14.9564 11.3032L9.18179 11.3032L9.85188 10.8021L10.5805 10.1187C10.715 9.99719 10.7822 9.84533 10.7822 9.66309C10.7822 9.48519 10.7258 9.33984 10.6131 9.22702C10.5046 9.10987 10.3637 9.05129 10.1902 9.05129C10.0124 9.05129 9.85839 9.11421 9.72827 9.24004L7.52932 11.3683C7.35583 11.5289 7.26909 11.7154 7.26909 11.928C7.26909 12.1493 7.35583 12.3402 7.52932 12.5008L9.72827 14.6226C9.85839 14.7484 10.0124 14.8113 10.1902 14.8113C10.3637 14.8113 10.5046 14.7549 10.6131 14.6421C10.7258 14.5249 10.7822 14.3752 10.7822 14.193C10.7822 14.0064 10.715 13.8546 10.5805 13.7374L9.83887 13.0605L9.18179 12.5594L14.9564 12.5593L14.2994 13.0605L13.5577 13.7374C13.4232 13.8545 13.356 14.0064 13.356 14.193C13.356 14.3752 13.4124 14.5249 13.5252 14.6421C13.6336 14.7549 13.7746 14.8113 13.948 14.8113C14.1259 14.8113 14.2798 14.7484 14.41 14.6225L16.6089 12.5008Z"
                fill="black"
              />
            </svg>
          </div>
        </div>
        <div className="flex flex-col items-center col-span-4 space-y-2">
          <Headline className="mb-2">You Buy</Headline>
          {selectedResourceIdsGet.map((id, index) => {
            let resource = getBalance(realmEntityId, id);
            let options = [resources.find((res) => res.id === id), ...unselectedResources] as any;
            options = options.map((res: any) => {
              const bal = getBalance(realmEntityId, res.id);
              return {
                id: res.id,
                label: (
                  <ResourceCost
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedResourcesGiveAmounts({
                        ...selectedResourcesGiveAmounts,
                        [id]: divideByPrecision(bal?.balance || 0),
                      });
                    }}
                    resourceId={res.id}
                    amount={divideByPrecision(bal?.balance || 0)}
                  />
                ),
              };
            });
            if (selectedResourceIdsGet.length > 1) {
              options = [
                {
                  id: 0,
                  label: (
                    <div className="flex items-center justify-center">
                      <div className="ml-1 text-danger">Remove item</div>
                    </div>
                  ),
                },
                ...options,
              ];
            }
            return (
              <div key={id} className="flex items-center w-full">
                <NumberInput
                  max={100000}
                  min={1}
                  value={selectedResourcesGetAmounts[id]}
                  onChange={(value) => {
                    setSelectedResourcesGetAmounts({
                      ...selectedResourcesGetAmounts,
                      [id]: value,
                    });
                  }}
                />
                {!resourcesListEditDisabled ? (
                  <ListSelect
                    className="ml-2 w-full"
                    style="black"
                    options={options}
                    value={selectedResourceIdsGet[index]}
                    onChange={(value) => {
                      if (value === 0) {
                        const tmp = [...selectedResourceIdsGet];
                        tmp.splice(index, 1);
                        setSelectedResourceIdsGet(tmp);
                        const tmpAmounts = { ...selectedResourcesGetAmounts };
                        delete tmpAmounts[id];
                        setSelectedResourcesGetAmounts(tmpAmounts);
                        return;
                      }
                      const tmp = [...selectedResourceIdsGet];
                      tmp[index] = value;
                      setSelectedResourceIdsGet(tmp);
                      setSelectedResourcesGetAmounts({
                        ...selectedResourcesGetAmounts,
                        [value]: 1,
                      });
                    }}
                  />
                ) : (
                  <ResourceCost className="ml-2" resourceId={id} amount={divideByPrecision(resource?.balance || 0)} />
                )}
              </div>
            );
          })}
          {!resourcesListEditDisabled && (
            <Button className="w-full" variant="primary" size="md" onClick={() => addResourceGet()}>
              Add Resource
            </Button>
          )}
        </div>
      </div>
      <div className="flex text-xs mt-2 text-center text-white">
        Total Items Weight <div className="ml-1 text-gold">{`${divideByPrecision(resourceWeight)}kg`}</div>
      </div>
      <div className="flex my-1 flex-row text-xxs text-center text-white">
        <div className="flex flex-col mx-1">
          <div> Food</div>
          <div className="ml-1 text-gold">{`${WEIGHTS[254]}kg/unit`}</div>
        </div>
        <div className="flex flex-col mx-1">
          <div> Resource</div>
          <div className="ml-1 text-gold">{`${WEIGHTS[1]}kg/unit`}</div>
        </div>
        <div className="flex flex-col mx-1">
          <div> Lords</div>
          <div className="ml-1 text-gold">{`${WEIGHTS[253]}kg/unit`}</div>
        </div>
      </div>
    </>
  );
};

export const SelectCaravanPanel = ({
  donkeysCount,
  setDonkeysCount,
  isNewCaravan,
  setIsNewCaravan,
  selectedCaravan,
  setSelectedCaravan,
  selectedResourceIdsGet,
  selectedResourceIdsGive,
  selectedResourcesGetAmounts,
  selectedResourcesGiveAmounts,
  resourceWeight,
  hasEnoughDonkeys,
  headline = "You Give",
  className,
}: {
  donkeysCount: number;
  setDonkeysCount: (donkeysCount: number) => void;
  isNewCaravan: boolean;
  setIsNewCaravan: (isNewCaravan: boolean) => void;
  selectedCaravan: bigint;
  setSelectedCaravan: (selectedCaravanId: bigint) => void;
  selectedResourceIdsGet: number[];
  selectedResourceIdsGive: number[];
  selectedResourcesGetAmounts: { [key: number]: number };
  selectedResourcesGiveAmounts: { [key: number]: number };
  resourceWeight: number;
  hasEnoughDonkeys: boolean;
  headline?: string;
  className?: string;
}) => {
  const { realmEntityId } = useRealmStore();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { useRealmDonkeysCount, useGetPositionCaravans } = useCaravan();
  const { getResourcesFromInventory } = useResources();
  const { realm } = useGetRealm(realmEntityId);
  const { caravans: realmCaravans } = useGetPositionCaravans(realm?.position.x || 0, realm?.position.y || 0);

  const [donkeysLeft, setDonkeysLeft] = useState<number>(0);
  const realmDonkeysCount = useRealmDonkeysCount(realmEntityId);
  useEffect(() => {
    if (realm) {
      setDonkeysLeft(realm.cities * DONKEYS_PER_CITY - (Number(realmDonkeysCount?.count) || 0));
    }
  }, [realmDonkeysCount]);

  useEffect(() => {
    setDonkeysCount(Math.min(donkeysLeft || 0, Math.ceil(divideByPrecision(resourceWeight) / WEIGHT_PER_DONKEY_KG)));
  }, [resourceWeight, donkeysLeft]);

  const canCarry = (caravan: CaravanInterface, resourceWeight: number) => {
    return caravan.capacity ? caravan.capacity >= resourceWeight : false;
  };

  let myAvailableCaravans = useMemo(
    () =>
      realmCaravans
        ? (realmCaravans
            .map((caravan) => {
              const resourcesCarried = getResourcesFromInventory(caravan.caravanId);
              const isIdle =
                caravan &&
                nextBlockTimestamp &&
                !caravan.blocked &&
                (!caravan.arrivalTime || caravan.arrivalTime <= nextBlockTimestamp) &&
                resourcesCarried.resources.length == 0;
              // capacity in gr (1kg = 1000gr)
              if (isIdle && canCarry(caravan, resourceWeight)) {
                return caravan;
              }
            })
            .filter(Boolean) as CaravanInterface[])
        : [],
    [realmCaravans, resourceWeight],
  );

  return (
    <div className={clsx("flex flex-col items-center w-full p-2", className)}>
      {isNewCaravan && (
        <>
          <div className="flex flex-col">
            <Headline className="mb-2">Summon a New Caravan</Headline>
            <div className="grid grid-cols-9 gap-2 p-2">
              <div className="flex items-center col-span-3">
                <NumberInput
                  value={donkeysCount}
                  onChange={(value) => setDonkeysCount(Math.min(donkeysLeft || 0, value))}
                  max={donkeysLeft || 0}
                />
                <Donkey className="ml-2 w-5 h-5 min-w-[20px]" />
                <div className="flex flex-col justify-center ml-2">
                  <div className="text-xs font-bold text-white">{donkeysLeft - donkeysCount}</div>
                  <div className="text-xs text-center text-white">Donkeys</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex mb-1 text-xs text-center text-white">
            Caravan Capacity{" "}
            <div className={`ml-1 text-${hasEnoughDonkeys ? "order-brilliance" : "danger"}`}>{`${
              donkeysCount * WEIGHT_PER_DONKEY_KG
            }kg`}</div>
          </div>
          <div className="w-1/2 flex flex-cols justify-between mb-2 ">
            <div className="flex flex-col items-center">
              <div className="flex text-xxs text-center text-white">Donkeys per city </div>
              <div className="flex text-xxs text-center text-gold"> 10 </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex text-xxs text-center text-white">Capacity per donkey </div>
              <div className="flex text-xxs text-center text-gold"> 100kg </div>
            </div>
          </div>
          {!hasEnoughDonkeys && (
            <div className="flex items-center mb-1 text-xs text-center text-white">
              <Danger />
              <div className="ml-1 uppercase text-danger">Increase the amount of units</div>
            </div>
          )}
          {/* <div className="flex items-center mb-1 text-xxs text-center text-white wrap-text">
            <div className="ml-1 text-danger">
              Warning: Once you have created a caravan of donkeys, they cannot be ungrouped. Please plan your strategy
              accordingly
            </div>
          </div> */}
        </>
      )}
      {!isNewCaravan && (
        <div
          onClick={() => setIsNewCaravan(true)}
          className="w-full mx-4 h-8 py-[7px] bg-dark-brown cursor-pointer rounded justify-center items-center"
        >
          <div className="text-xs text-center text-gold">+ New Caravan</div>
        </div>
      )}
      {isNewCaravan && myAvailableCaravans.length > 0 && (
        <div className="flex flex-col w-full mt-2">
          <Headline className="mb-2">Or choose from existing Caravans</Headline>
        </div>
      )}
      {isNewCaravan && myAvailableCaravans.length > 0 && (
        <div
          onClick={() => setIsNewCaravan(false)}
          className="w-full mx-4 h-8 py-[7px] bg-dark-brown cursor-pointer rounded justify-center items-center"
        >
          <div className="text-xs text-center text-gold">{`Show ${myAvailableCaravans.length} idle Caravans`}</div>
        </div>
      )}
      {!isNewCaravan && (
        <div className="flex flex-col max-h-[350px] overflow-auto w-full">
          {myAvailableCaravans.map((caravan) => (
            <Caravan
              key={caravan.caravanId}
              caravan={caravan}
              idleOnly={true}
              onClick={() => setSelectedCaravan(caravan.caravanId)}
              className={`w-full mt-2 border rounded-md ${
                selectedCaravan === caravan.caravanId ? "border-order-brilliance" : ""
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
