import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { Headline } from "../../../../elements/Headline";
import { ResourceCost } from "../../../../elements/ResourceCost";
import { NumberInput } from "../../../../elements/NumberInput";
import { SelectableResource } from "../../../../elements/SelectableResource";
import { resources } from "../../../../constants/resources";
import { ReactComponent as ArrowSeparator } from "../../../../assets/icons/common/arrow-separator.svg";
import { ReactComponent as Danger } from "../../../../assets/icons/common/danger.svg";
import { ReactComponent as Donkey } from "../../../../assets/icons/units/donkey.svg";
import { Caravan } from "./Caravans/Caravan";
import { Steps } from "../../../../elements/Steps";
import { CaravanInterface, getLatestRealmId } from "../../../../hooks/graphql/useGraphQLQueries";
import { useDojo } from "../../../../DojoContext";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { useCaravan, useGetRealmCaravans } from "../../../../hooks/helpers/useCaravans";
import { getEntityIdFromKeys } from "../../../../utils/utils";
import { HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useGetRealm } from "../../../../hooks/helpers/useRealm";
import { Realm } from "../../../../types";
import { getRealm } from "../../../../utils/realms";
import { getOrderName } from "../../../../constants/orders";
import { OrderIcon } from "../../../../elements/OrderIcon";
import { useTrade } from "../../../../hooks/helpers/useTrade";

type CreateOfferPopupProps = {
  onClose: () => void;
  onCreate: () => void;
};

export const CreateOfferPopup = ({ onClose }: CreateOfferPopupProps) => {
  const [step, setStep] = useState<number>(1);
  const [selectedResourceIdsGive, setSelectedResourceIdsGive] = useState<number[]>([]);
  const [selectedResourceIdsGet, setSelectedResourceIdsGet] = useState<number[]>([]);
  const [selectedResourcesGiveAmounts, setSelectedResourcesGiveAmounts] = useState<{ [key: number]: number }>({});
  const [selectedResourcesGetAmounts, setSelectedResourcesGetAmounts] = useState<{ [key: number]: number }>({});
  const [selectedCaravan, setSelectedCaravan] = useState<number>(0);
  const [selectedRealmEntityId, setSelectedRealmEntityId] = useState<number | undefined>();
  const [selectedRealmId, setSelectedRealmId] = useState<number | undefined>();
  const [isNewCaravan, setIsNewCaravan] = useState(false);
  const [donkeysCount, setDonkeysCount] = useState(1);
  const [resourceWeight, setResourceWeight] = useState(0);
  const [hasEnoughDonkeys, setHasEnoughDonkeys] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    account: { account },
    setup: {
      optimisticSystemCalls: { optimisticMakeFungibleOrder },
      systemCalls: { create_caravan, create_free_transport_unit, make_fungible_order, attach_caravan },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { getRealmEntityIdFromRealmId } = useTrade();

  const onSelectRealmId = (realmId: number) => {
    const entityId = getRealmEntityIdFromRealmId(realmId);
    entityId && setSelectedRealmEntityId(entityId);
  };

  const createOrder = async () => {
    setIsLoading(true);
    if (isNewCaravan) {
      const trade_id = await optimisticMakeFungibleOrder(make_fungible_order)({
        signer: account,
        maker_id: realmEntityId,
        maker_entity_types: selectedResourceIdsGive,
        maker_quantities: Object.values(selectedResourcesGiveAmounts),
        taker_id: selectedRealmEntityId || 0,
        taker_entity_types: selectedResourceIdsGet,
        taker_quantities: Object.values(selectedResourcesGetAmounts),
      });
      const transport_units_id = await create_free_transport_unit({
        signer: account,
        realm_id: realmEntityId,
        quantity: donkeysCount,
      });
      const caravan_id = await create_caravan({
        signer: account,
        entity_ids: [transport_units_id],
      });
      await attach_caravan({
        signer: account,
        realm_id: realmEntityId,
        trade_id,
        caravan_id,
      });
    } else {
      const trade_id = await make_fungible_order({
        signer: account,
        maker_id: realmEntityId,
        maker_entity_types: selectedResourceIdsGive,
        maker_quantities: Object.values(selectedResourcesGiveAmounts),
        taker_id: selectedRealmEntityId || 0,
        taker_entity_types: selectedResourceIdsGet,
        taker_quantities: Object.values(selectedResourcesGetAmounts),
      });
      await attach_caravan({
        signer: account,
        realm_id: realmEntityId,
        trade_id,
        caravan_id: selectedCaravan,
      });
    }
    onClose();
  };

  const canGoToNextStep = useMemo(() => {
    if (step === 1) {
      return selectedResourceIdsGive.length > 0 && selectedResourceIdsGet.length > 0;
    } else if (step === 3) {
      return selectedCaravan !== 0 || (hasEnoughDonkeys && isNewCaravan);
    } else {
      return true;
    }
  }, [step, selectedCaravan, hasEnoughDonkeys, selectedResourceIdsGet, selectedResourceIdsGive, isNewCaravan]);

  useEffect(() => {
    setHasEnoughDonkeys(donkeysCount * 100 >= resourceWeight);
  }, [donkeysCount, resourceWeight]);

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Create Offer:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body>
        <div className="flex flex-col items-center pt-2">
          {step == 1 && (
            <SelectResourcesPanel
              selectedResourceIdsGive={selectedResourceIdsGive}
              setSelectedResourceIdsGive={(e) => {
                setSelectedResourceIdsGive(e);
                setSelectedResourcesGiveAmounts(Object.fromEntries(e.map((id) => [id, 1])));
              }}
              selectedResourceIdsGet={selectedResourceIdsGet}
              setSelectedResourceIdsGet={(e) => {
                setSelectedResourceIdsGet(e);
                setSelectedResourcesGetAmounts(Object.fromEntries(e.map((id) => [id, 1])));
              }}
            />
          )}
          {step == 2 && (
            <SelectResourcesAmountPanel
              selectedResourceIdsGive={selectedResourceIdsGive}
              selectedResourcesGiveAmounts={selectedResourcesGiveAmounts}
              setSelectedResourcesGiveAmounts={setSelectedResourcesGiveAmounts}
              resourceWeight={resourceWeight}
              selectedResourceIdsGet={selectedResourceIdsGet}
              selectedResourcesGetAmounts={selectedResourcesGetAmounts}
              setSelectedResourcesGetAmounts={setSelectedResourcesGetAmounts}
              setResourceWeight={setResourceWeight}
              selectedRealmId={selectedRealmId}
              setSelectedRealmId={setSelectedRealmId}
            />
          )}
          {step == 3 && (
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
          )}
        </div>
        <div className="flex justify-between m-2 text-xxs">
          <Button
            className="!px-[6px] !py-[2px] text-xxs"
            onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
            variant="outline"
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <Steps className="absolute -translate-x-1/2 left-1/2 bottom-4" step={step} maxStep={3} />
          {!isLoading && (
            <Button
              className="!px-[6px] !py-[2px] text-xxs"
              disabled={!canGoToNextStep}
              onClick={() => {
                if (step === 3) {
                  createOrder();
                } else {
                  if (step === 2) {
                    selectedRealmId && onSelectRealmId(selectedRealmId);
                  }
                  setStep(step + 1);
                }
              }}
              variant={canGoToNextStep ? "success" : "danger"}
            >
              {step == 3 ? "Create Offer" : "Next Step"}
            </Button>
          )}
          {isLoading && (
            <Button
              isLoading={true}
              onClick={() => {}}
              variant="danger"
              className="ml-auto p-2 !h-4 text-xxs !rounded-md"
            >
              {" "}
              {}{" "}
            </Button>
          )}
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

const SelectResourcesPanel = ({
  selectedResourceIdsGive,
  setSelectedResourceIdsGive,
  selectedResourceIdsGet,
  setSelectedResourceIdsGet,
}: {
  selectedResourceIdsGive: number[];
  setSelectedResourceIdsGive: (selectedResourceIds: number[]) => void;
  selectedResourceIdsGet: number[];
  setSelectedResourceIdsGet: (selectedResourceIds: number[]) => void;
}) => {
  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  return (
    <div className="grid grid-cols-9 gap-2 p-2">
      <div className="flex flex-col items-center col-span-4">
        <Headline className="mb-2">You Give</Headline>
        <div className="grid grid-cols-4 gap-2">
          {resources.map(({ id, trait: _name }) => {
            let resource = getComponentValue(Resource, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(id)]));
            return (
              <SelectableResource
                key={id}
                resourceId={id}
                amount={resource?.balance || 0}
                disabled={(resource?.balance || 0) === 0}
                selected={selectedResourceIdsGive.includes(id)}
                onClick={() => {
                  if (selectedResourceIdsGive.includes(id)) {
                    setSelectedResourceIdsGive(selectedResourceIdsGive.filter((_id) => _id !== id));
                  } else {
                    setSelectedResourceIdsGive([...selectedResourceIdsGive, id]);
                  }
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-center">
        <ArrowSeparator />
      </div>
      <div className="flex flex-col items-center col-span-4">
        <Headline className="mb-2">You Get</Headline>
        <div className="grid grid-cols-4 gap-2">
          {resources.map(({ id, trait: _name }) => {
            let resource = getComponentValue(Resource, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(id)]));
            return (
              <SelectableResource
                key={id}
                resourceId={id}
                amount={resource?.balance || 0}
                selected={selectedResourceIdsGet.includes(id)}
                disabled={selectedResourceIdsGive.includes(id)}
                onClick={() => {
                  if (selectedResourceIdsGet.includes(id)) {
                    setSelectedResourceIdsGet(selectedResourceIdsGet.filter((_id) => _id !== id));
                  } else {
                    setSelectedResourceIdsGet([...selectedResourceIdsGet, id]);
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SelectResourcesAmountPanel = ({
  selectedResourceIdsGive,
  selectedResourceIdsGet,
  selectedResourcesGiveAmounts,
  selectedResourcesGetAmounts,
  resourceWeight,
  setSelectedResourcesGiveAmounts,
  setSelectedResourcesGetAmounts,
  setResourceWeight,
  selectedRealmId,
  setSelectedRealmId,
}: {
  selectedResourceIdsGive: number[];
  selectedResourceIdsGet: number[];
  selectedResourcesGiveAmounts: { [key: number]: number };
  selectedResourcesGetAmounts: { [key: number]: number };
  resourceWeight: number;
  setSelectedResourcesGiveAmounts: (selectedResourcesGiveAmounts: { [key: number]: number }) => void;
  setSelectedResourcesGetAmounts: (selectedResourcesGetAmounts: { [key: number]: number }) => void;
  setResourceWeight: (resourceWeight: number) => void;
  selectedRealmId: number | undefined;
  setSelectedRealmId: (selectedRealmId: number) => void;
}) => {
  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  useEffect(() => {
    // set resource weight in kg
    let weight = 0;
    for (const [_resourceId, amount] of Object.entries(selectedResourcesGiveAmounts)) {
      weight += amount * 1;
    }
    setResourceWeight(weight);
  }, [selectedResourcesGiveAmounts]);

  return (
    <>
      <div className="grid grid-cols-9 gap-2 p-2">
        <div className="flex flex-col items-center col-span-4 space-y-2">
          <Headline className="mb-2">You Give</Headline>
          {selectedResourceIdsGive.map((id) => {
            let resource = getComponentValue(Resource, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(id)]));
            return (
              <div key={id} className="flex items-center w-full">
                <NumberInput
                  max={resource?.balance || 0}
                  value={selectedResourcesGiveAmounts[id]}
                  onChange={(value) => {
                    setSelectedResourcesGiveAmounts({
                      ...selectedResourcesGiveAmounts,
                      [id]: Math.min(resource?.balance || 0, value),
                    });
                  }}
                />
                <div className="ml-2">
                  <ResourceCost resourceId={id} amount={selectedResourcesGiveAmounts[id]} />
                </div>
                <div
                  className={`ml-2 text-xs ${
                    selectedResourcesGiveAmounts[id] <= (resource?.balance || 0) ? "text-orange" : "text-red"
                  } cursor-pointer`}
                  onClick={() => {
                    setSelectedResourcesGiveAmounts({
                      ...selectedResourcesGiveAmounts,
                      [id]: resource?.balance || 0,
                    });
                  }}
                >
                  {`Max ${resource?.balance || 0}`}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center">
          <ArrowSeparator />
        </div>
        <div className="flex flex-col items-center col-span-4 space-y-2">
          <Headline className="mb-2">You Get</Headline>
          {selectedResourceIdsGet.map((id) => (
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
              <div className="ml-2">
                <ResourceCost resourceId={id} amount={selectedResourcesGetAmounts[id]} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex text-xs text-center text-white">
        Items Weight <div className="ml-1 text-gold">{`${resourceWeight}kg`}</div>
      </div>
      <SelectRealmIdPanel
        selectedRealmId={selectedRealmId}
        setSelectedRealmId={setSelectedRealmId}
      ></SelectRealmIdPanel>
    </>
  );
};

export const SelectRealmIdPanel = ({
  selectedRealmId,
  setSelectedRealmId,
}: {
  selectedRealmId: number | undefined;
  setSelectedRealmId: (selectedRealmId: number) => void;
}) => {
  const [specifyRealmId, setSpecifyRealmId] = useState(false);
  const [allRealms, setAllRealms] = useState<Realm[]>([]); // This would ideally be populated from an API call or similar.

  const { realmId, realmEntityId } = useRealmStore();

  const { getRealmEntityIdFromRealmId } = useTrade();

  const { calculateDistance } = useCaravan();

  useEffect(() => {
    const buildRealmIds = async () => {
      const realm_id = await getLatestRealmId();
      setAllRealms(
        Array.from({ length: realm_id }, (_, i) => i + 1)
          .map((id) => {
            return getRealm(id);
          })
          .filter((realm) => realm.realm_id !== realmId && realm.realm_id !== 1),
      );
    };
    buildRealmIds();
  }, []);

  return (
    <div className="flex flex-col items-center w-full p-2">
      {!specifyRealmId && (
        <div
          onClick={() => setSpecifyRealmId(true)}
          className="w-full mx-4 h-8 py-[7px] bg-dark-brown cursor-pointer rounded justify-center items-center"
        >
          <div className="text-xs text-center text-gold"> + Make Direct Offer</div>
        </div>
      )}
      {specifyRealmId && (
        <div
          onClick={() => setSpecifyRealmId(false)}
          className="w-full mx-4 h-8 py-[7px] bg-dark-brown cursor-pointer rounded justify-center items-center"
        >
          <div className="text-xs text-center text-gold">Back to Market Offer</div>
        </div>
      )}
      {specifyRealmId && realmEntityId && (
        <div>
          <input
            type="number"
            id="realm-id"
            value={selectedRealmId || ""}
            onChange={(e) => setSelectedRealmId(Number(e.target.value))}
            placeholder="Enter realm id..."
          />
          <div className="bg-gray-100 p-4 rounded shadow-lg max-h-[150px] overflow-y-auto text-gold">
            {allRealms.map(({ order, name, realm_id: takerRealmId }) => {
              const takerEntityId = getRealmEntityIdFromRealmId(takerRealmId);
              const distance = takerEntityId ? calculateDistance(realmEntityId, takerEntityId) : 0;
              return (
                <div
                  key={takerRealmId}
                  className={`realmItem ${selectedRealmId === takerRealmId ? "active" : ""}`}
                  onClick={() => setSelectedRealmId(takerRealmId)}
                >
                  <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
                    {takerRealmId}
                    <OrderIcon order={getOrderName(order)} size="xs" className="mr-1" />
                    {name}-{`${distance?.toFixed(0)} km`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
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
}: {
  donkeysCount: number;
  setDonkeysCount: (donkeysCount: number) => void;
  isNewCaravan: boolean;
  setIsNewCaravan: (isNewCaravan: boolean) => void;
  selectedCaravan: number;
  setSelectedCaravan: (selectedCaravanId: number) => void;
  selectedResourceIdsGet: number[];
  selectedResourceIdsGive: number[];
  selectedResourcesGetAmounts: { [key: number]: number };
  selectedResourcesGiveAmounts: { [key: number]: number };
  resourceWeight: number;
  hasEnoughDonkeys: boolean;
}) => {
  const { realmEntityId } = useRealmStore();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { realm } = useGetRealm(realmEntityId);
  const { realmCaravans } = useGetRealmCaravans(realm?.position.x || 0, realm?.position.y || 0);

  let myAvailableCaravans = useMemo(
    () =>
      realmCaravans
        ? (realmCaravans
            .map((caravan) => {
              const isIdle =
                caravan &&
                nextBlockTimestamp &&
                !caravan.blocked &&
                (!caravan.arrivalTime || caravan.arrivalTime <= nextBlockTimestamp);
              // capacity in gr (1kg = 1000gr)
              const canCarry = caravan.capacity ? caravan.capacity / 1000 >= resourceWeight : false;
              if (isIdle && canCarry) {
                return caravan;
              }
            })
            .filter(Boolean) as CaravanInterface[])
        : [],
    [realmCaravans],
  );

  return (
    <div className="flex flex-col items-center w-full p-2">
      <div className="grid grid-cols-9 gap-2">
        <div className="flex flex-col items-center col-span-4 space-y-2 h-min">
          <Headline className="mb-2">You Give</Headline>
          <div className="flex items-center justify-center w-full">
            {selectedResourceIdsGive.map((id) => (
              <ResourceCost
                key={id}
                className="!w-min mx-2"
                resourceId={id}
                color="text-gold"
                type="vertical"
                amount={-selectedResourcesGiveAmounts[id]}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <ArrowSeparator />
        </div>
        <div className="flex flex-col items-center col-span-4 space-y-2 h-min">
          <Headline className="mb-2">You Get</Headline>
          <div className="flex items-center justify-center w-full">
            {selectedResourceIdsGet.map((id) => (
              <ResourceCost
                key={id}
                className="!w-min mx-2"
                type="vertical"
                color="text-brilliance"
                resourceId={id}
                amount={selectedResourcesGetAmounts[id]}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex mb-3 text-xs text-center text-white">
        Items Weight <div className="ml-1 text-gold">{`${resourceWeight}kg`}</div>
      </div>
      {isNewCaravan && (
        <>
          <div className="flex flex-col">
            <Headline className="mb-2">Summon a New Caravan</Headline>
            <div className="grid grid-cols-9 gap-2 p-2">
              <div className="flex items-center col-span-3">
                <NumberInput value={donkeysCount} onChange={setDonkeysCount} max={1000} />
                <Donkey className="ml-2" />
                <div className="flex flex-col justify-center ml-2">
                  <div className="text-xs font-bold text-white">{donkeysCount}</div>
                  <div className="text-xs text-center text-white">Donkeys</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex mb-1 text-xs text-center text-white">
            Caravan Capacity{" "}
            <div className={`ml-1 text-${hasEnoughDonkeys ? "success" : "danger"}`}>{`${donkeysCount * 100}kg`}</div>
          </div>
          {!hasEnoughDonkeys && (
            <div className="flex items-center mb-1 text-xs text-center text-white">
              <Danger />
              <div className="ml-1 uppercase text-danger">Increase the amount of units</div>
            </div>
          )}
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
        <>
          {myAvailableCaravans.map((caravan) => (
            <Caravan
              caravan={caravan}
              idleOnly={true}
              onClick={() => setSelectedCaravan(caravan.caravanId)}
              className={`w-full mt-2 border rounded-md ${
                selectedCaravan === caravan.caravanId ? "border-order-brilliance" : ""
              }`}
            />
          ))}
        </>
      )}
    </div>
  );
};
