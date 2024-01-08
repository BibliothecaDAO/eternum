import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../elements/SecondaryPopup";
import Button from "../../../elements/Button";
import { SelectCaravanPanel } from "../../cityview/realm/trade/CreateOffer";
import { ReactComponent as ArrowSeparator } from "../../../assets/icons/common/arrow-separator.svg";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { getRealm } from "../../../utils/realms";
import { getComponentValue } from "@dojoengine/recs";
import { divideByPrecision, getEntityIdFromKeys, multiplyByPrecision } from "../../../utils/utils";
import { useDojo } from "../../../DojoContext";
import { Steps } from "../../../elements/Steps";
import { Headline } from "../../../elements/Headline";
import { OrderIcon } from "../../../elements/OrderIcon";
import { BankInterface, BankStaticInterface, orderNameDict } from "@bibliothecadao/eternum";
import { ResourceCost } from "../../../elements/ResourceCost";
import clsx from "clsx";
import { Tabs } from "../../../elements/tab";
import { useCaravan } from "../../../hooks/helpers/useCaravans";
import { WEIGHT_PER_DONKEY_KG } from "@bibliothecadao/eternum";
import useUIStore from "../../../hooks/store/useUIStore";
import { BANK_AUCTION_DECAY, targetPrices, useBanks } from "../../../hooks/helpers/useBanks";
import { BankCaravansPanel } from "./BanksCaravans/BankCaravansPanel";
import { NumberInput } from "../../../elements/NumberInput";
import { getLordsAmountFromBankAuction } from "./utils";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { useLevel } from "../../../hooks/helpers/useLevel";
import { getTotalResourceWeight } from "../../cityview/realm/trade/utils";

type BankPopupProps = {
  onClose: () => void;
  bank: BankStaticInterface;
};

export const BankPopup = ({ onClose, bank }: BankPopupProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const { useGetBank } = useBanks();
  const { useGetPositionCaravans } = useCaravan();

  const bankInfo = useGetBank(bank);

  const { caravans } = bankInfo ? useGetPositionCaravans(bankInfo.position.x, bankInfo.position.y) : { caravans: [] };

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Initialize or feed Hyperstructure with resources.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>Swap</div>
          </div>
        ),
        component: (
          <SwapResourcesPanel
            onSendCaravan={() => setSelectedTab(1)}
            onClose={onClose}
            bank={bankInfo}
            bankPrice={bankInfo?.wheatPrice || 0}
          />
        ),
      },
      {
        key: "my",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Watch incoming caravans.</p>
                    <p className="whitespace-nowrap">Pass resources to Hyperstructure on arriving.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex group relative flex-col items-center"
          >
            <div>{`Caravans (${caravans.length})`}</div>
          </div>
        ),
        component: <BankCaravansPanel caravans={caravans} bank={bankInfo} />,
      },
    ],
    [selectedTab, caravans],
  );

  return (
    <SecondaryPopup name="hyperstructure">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5 bg-gray">Bank Swap:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"460px"}>
        <Tabs
          selectedIndex={selectedTab}
          onChange={(index: any) => setSelectedTab(index)}
          variant="default"
          className="h-full"
        >
          <Tabs.List className="!border-t-transparent">
            {tabs.map((tab, index) => (
              <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panels className="overflow-hidden">
            {tabs.map((tab, index) => (
              <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

const SelectableRealm = ({ realm, selected = false, onClick, costs, ...props }: any) => {
  const { getEntityLevel } = useLevel();

  const level = useMemo(() => {
    return getEntityLevel(realm.entity_id)?.level || 0;
  }, [realm]);

  return (
    <div
      className={clsx(
        "flex flex-col relative items-center p-2 border rounded-md text-xxs text-gray-gold",
        "border-gray-gold",
      )}
      {...props}
    >
      {realm && (
        <div className="flex absolute items-center p-1 top-0 left-0 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
          {realm.order && <OrderIcon order={orderNameDict[realm.order]} size="xs" className="mr-1" />}
          {realm.name}
        </div>
      )}
      <div className="text-gold ml-auto absolute right-2 top-2">24h:10m away</div>
      {level < 2 && <div className="text-xxs text-order-giants">Min level 2 to use Banks</div>}
      <div className="flex items-center mt-6 w-full">
        <div className="flex">
          {realm.resources &&
            realm.resources.map((resource: any) => {
              return (
                <ResourceCost
                  type="vertical"
                  withTooltip
                  key={resource.id}
                  resourceId={parseInt(resource.id)}
                  amount={divideByPrecision(resource.balance)}
                  color={resource.balance >= 0 ? "text-order-brilliance" : "text-order-giants"}
                />
              );
            })}
        </div>
        <Button disabled={level < 2} onClick={onClick} className="h-6 text-xxs ml-auto" variant="success">
          {`Set the amounts`}
        </Button>
      </div>
    </div>
  );
};

const PercentageSelection = ({ setPercentage }: { setPercentage: (percentage: number) => void }) => {
  const percentages = [0, 25, 50, 75, 100];
  return (
    <div className="w-[80%] flex flex-row items-center justify-center">
      {percentages.map((percentage) => (
        <Button variant={"outline"} className={"!p-1 my-2 mr-3 w-20"} onClick={() => setPercentage(percentage)}>
          {`${percentage}%`}
        </Button>
      ))}
    </div>
  );
};

const SwapResourcesPanel = ({
  onClose,
  onSendCaravan,
  bank,
  bankPrice: number,
}: {
  onClose: () => void;
  onSendCaravan: () => void;
  bank: BankInterface | undefined;
  bankPrice: number;
}) => {
  const [selectedCaravan, setSelectedCaravan] = useState<bigint>(0n);
  const [isNewCaravan, setIsNewCaravan] = useState(false);
  const [donkeysCount, setDonkeysCount] = useState(1);
  const [hasEnoughDonkeys, setHasEnoughDonkeys] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  const {
    account: { account },
    setup: {
      systemCalls: { send_resources_to_location },
    },
  } = useDojo();

  const sendResourcesToBank = async () => {
    setIsLoading(true);
    if (bank) {
      const resourcesList = Object.keys(feedResourcesGiveAmounts)
        .filter((id) => feedResourcesGiveAmounts[Number(id)] > 0)
        .flatMap((id) => [Number(id), multiplyByPrecision(feedResourcesGiveAmounts[Number(id)])]);
      if (isNewCaravan) {
        await send_resources_to_location({
          signer: account,
          sending_entity_id: realmEntityId,
          resources: resourcesList || [],
          destination_coord_x: bank.position.x,
          destination_coord_y: bank.position.y,
          donkeys_quantity: donkeysCount,
        });
      } else {
        // transfer resources to caravan
        await send_resources_to_location({
          signer: account,
          sending_entity_id: realmEntityId,
          resources: resourcesList || [],
          destination_coord_x: bank.position.x,
          destination_coord_y: bank.position.y,
          caravan_id: selectedCaravan,
        });
      }
      onSendCaravan();
    }
  };

  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const setRealmEntityId = useRealmStore((state) => state.setRealmEntityId);
  const [percentage, setPercentage] = useState<number>(0);
  const [feedResourcesGiveAmounts, setFeedResourcesGiveAmounts] = useState<{ [key: number]: number }>({
    254: 0,
    255: 0,
  });

  // TODO: use same precision everywhere
  const resourceWeight = useMemo(() => {
    const resourcesGive = Object.keys(feedResourcesGiveAmounts).map((resourceId) => {
      return {
        resourceId: parseInt(resourceId),
        amount: feedResourcesGiveAmounts[parseInt(resourceId)],
      };
    });
    return multiplyByPrecision(getTotalResourceWeight(resourcesGive));
  }, [feedResourcesGiveAmounts]);

  const realms = useMemo(
    () =>
      realmEntityIds.map((realmEntityId) => {
        const _realm = getRealm(realmEntityId.realmId);
        const _resources = Object.keys(feedResourcesGiveAmounts).map((resourceId) => ({
          id: resourceId,
          balance:
            Number(
              getComponentValue(
                Resource,
                getEntityIdFromKeys([BigInt(realmEntityId.realmEntityId), BigInt(resourceId)]),
              )?.balance,
            ) || 0,
        }));
        return { ..._realm, entity_id: realmEntityId.realmEntityId, resources: _resources };
      }),
    [realmEntityIds],
  );

  const canGoToNextStep = useMemo(() => {
    if (step === 3) {
      return selectedCaravan !== 0n || (hasEnoughDonkeys && isNewCaravan);
    } else if (step == 2) {
      return false;
    } else {
      return true;
    }
  }, [step, selectedCaravan, hasEnoughDonkeys, isNewCaravan]);

  const lordsAmountFromWheat = useMemo(() => {
    return bank?.wheatAuction && nextBlockTimestamp
      ? getLordsAmountFromBankAuction(
          multiplyByPrecision(feedResourcesGiveAmounts[254] || 0),
          targetPrices[254],
          BANK_AUCTION_DECAY,
          Number(bank.wheatAuction.per_time_unit),
          bank.wheatAuction.start_time,
          nextBlockTimestamp,
          Number(bank.wheatAuction.sold),
          Number(bank.wheatAuction.price_update_interval),
        )
      : 0;
  }, [feedResourcesGiveAmounts[254]]);

  const lordsAmountFromFish = useMemo(() => {
    return bank?.fishAuction && nextBlockTimestamp
      ? getLordsAmountFromBankAuction(
          multiplyByPrecision(feedResourcesGiveAmounts[255] || 0),
          targetPrices[255],
          BANK_AUCTION_DECAY,
          Number(bank.fishAuction.per_time_unit),
          bank.fishAuction.start_time,
          nextBlockTimestamp,
          Number(bank.fishAuction.sold),
          Number(bank.fishAuction.price_update_interval),
        )
      : 0;
  }, [feedResourcesGiveAmounts[255]]);

  useEffect(() => {
    if (donkeysCount * WEIGHT_PER_DONKEY_KG >= divideByPrecision(resourceWeight)) {
      setHasEnoughDonkeys(true);
    } else {
      setHasEnoughDonkeys(false);
    }
  }, [donkeysCount, resourceWeight]);

  const totalResources = useMemo(() => {
    const totalResources: Record<string, number> = {};
    Object.keys(feedResourcesGiveAmounts).forEach((resourceId) => {
      let resourceAmount = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
      );
      totalResources[resourceId] = Number(resourceAmount?.balance) || 0;
    });
    return totalResources;
  }, [realmEntityId]);

  useEffect(() => {
    const feedResourcesGiveAmounts: Record<string, number> = {};
    Object.keys(totalResources).forEach((id) => {
      (feedResourcesGiveAmounts[id] = Math.floor(divideByPrecision((totalResources[id] * percentage) / 100))),
        setFeedResourcesGiveAmounts(feedResourcesGiveAmounts);
    });
  }, [percentage]);

  return (
    <div className="flex flex-col items-center p-2">
      <div className="flex flex-col space-y-2 text-xs w-full mb-3">
        <div className="flex justify-between">
          <div className="flex items-center"></div>
          <div className="flex flex-col text-xxs text-right">
            <span className="text-gray-gold italic">State</span>
          </div>
        </div>
      </div>
      {step == 1 && (
        <>
          <div className="flex flex-col space-y-2 text-xs">
            <div className="relative w-full">
              <img src={`/images/buildings/bank.png`} className="object-cover w-full h-full rounded-[10px]" />
              <div className="flex flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/60">
                <div className="mb-1 ml-1 italic text-light-pink text-xxs"></div>
                <div className="mb-1 ml-1 italic text-light-pink text-xxs">Price per Lord :</div>
                {bank && (
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { resourceId: 254, amount: bank.wheatPrice * 1000 },
                      { resourceId: 255, amount: bank.fishPrice * 1000 },
                    ].map(({ resourceId, amount }) => (
                      <ResourceCost
                        withTooltip
                        type="vertical"
                        key={resourceId}
                        resourceId={resourceId}
                        amount={divideByPrecision(amount)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Headline size="big"> Swap Food for Lords</Headline>
            <div className="text-xxs mb-2 italic text-gold">
              {`
                To swap wheat or fish for Lords at the bank, you can send any amount you want. The amount of Lords you get in return depends on the market price of wheat and fish at that specific bank.
              `}
            </div>

            <div className="text-xxs mb-2 italic text-white">{`Click the "Next" button to select a Realm from which you want to swap food.`}</div>
          </div>
        </>
      )}
      {step == 2 && (
        <div className="flex flex-col w-full space-y-2">
          <Headline size="big">Select Realm - Step {step}</Headline>
          <div className="text-xxs mb-2 italic text-gold">
            {`Press "Set the amounts" on any Realm with required resources, to set amounts and send caravan to Hyperstructure.`}
          </div>
          {realms.map((realm) => (
            <SelectableRealm
              key={realm.realmId}
              realm={realm}
              onClick={() => {
                setRealmEntityId(realm.entity_id);
                setStep(step + 1);
              }}
              costs={[]}
              selected={realmEntityId === realm.entity_id}
            />
          ))}
        </div>
      )}
      {step == 3 && (
        <>
          <>
            <div className="grid relative grid-cols-9 gap-2 max-h-[350px] overflow-auto mb-4">
              <div className={clsx("flex flex-col items-center  space-y-2 h-min", "col-span-4")}>
                <Headline className="mb-2">You Give</Headline>
                {Object.keys(totalResources).map((_id) => {
                  const id: number = Number(_id);
                  return (
                    <div key={id} className="flex items-center w-full h-8">
                      <NumberInput
                        max={totalResources[id]}
                        min={1}
                        step={targetPrices[id as 254 | 255]}
                        value={feedResourcesGiveAmounts[id]}
                        onChange={(value) => {
                          setFeedResourcesGiveAmounts({
                            ...feedResourcesGiveAmounts,
                            [id]: Math.min(divideByPrecision(totalResources[id] || 0), value),
                          });
                        }}
                      />
                      <div className="ml-2">
                        <ResourceCost
                          className=" cursor-pointer"
                          onClick={() => {
                            setFeedResourcesGiveAmounts({
                              ...feedResourcesGiveAmounts,
                              [id]: divideByPrecision(totalResources[id] || 0),
                            });
                          }}
                          resourceId={id}
                          amount={divideByPrecision(totalResources[id] || 0)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center">
                <ArrowSeparator className="fixed top-1/6" />
              </div>
              <div className="flex flex-col w-full col-span-4 space-y-2 h-min">
                <Headline className="mb-2">You Get</Headline>
                <div className="w-full flex justify-center">
                  <ResourceCost
                    className="!w-min h-8 cursor-pointer"
                    resourceId={253}
                    amount={lordsAmountFromWheat + lordsAmountFromFish}
                    onClick={() => {}}
                  />
                </div>
              </div>
            </div>
          </>
          <PercentageSelection setPercentage={setPercentage}></PercentageSelection>
          <SelectCaravanPanel
            className="!p-0"
            donkeysCount={donkeysCount}
            setDonkeysCount={setDonkeysCount}
            isNewCaravan={isNewCaravan}
            setIsNewCaravan={setIsNewCaravan}
            selectedCaravan={selectedCaravan}
            setSelectedCaravan={setSelectedCaravan}
            selectedResourceIdsGet={[]}
            selectedResourcesGetAmounts={[]}
            selectedResourceIdsGive={[]}
            selectedResourcesGiveAmounts={[]}
            resourceWeight={resourceWeight}
            hasEnoughDonkeys={hasEnoughDonkeys}
            headline="Select Caravan - Step 3"
          />
        </>
      )}
      <div className="flex justify-between items-center mt-3 w-full text-xxs">
        <Button
          className="!px-[6px] !py-[2px] text-xxs"
          onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
          variant="outline"
        >
          {step === 1 ? "Cancel" : "Back"}
        </Button>
        <Steps className="absolute -translate-x-1/2 left-1/2 bottom-3" step={step} maxStep={3} />
        {!isLoading && (
          <Button
            className="!px-[6px] !py-[2px] text-xxs ml-auto"
            disabled={!canGoToNextStep}
            isLoading={isLoading}
            onClick={() => {
              if (step == 3) {
                sendResourcesToBank();
              } else {
                setStep(step + 1);
              }
            }}
            variant={canGoToNextStep ? "success" : "outline"}
          >
            {step == 3 ? "Send Caravan" : "Next Step"}
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
    </div>
  );
};
