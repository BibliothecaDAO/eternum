import { useEffect, useMemo, useState } from "react";
import Button from "../../../../elements/Button";
import { Headline } from "../../../../elements/Headline";
import { ResourceCost } from "../../../../elements/ResourceCost";
import { NumberInput } from "../../../../elements/NumberInput";
import { ResourcesIds, ONE_MONTH, resources } from "@bibliothecadao/eternum";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { divideByPrecision, multiplyByPrecision } from "../../../../utils/utils";
import { useRealm } from "../../../../../hooks/helpers/useRealm";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import ListSelect from "../../../../elements/ListSelect";
import { TradeRealmSelector } from "./TradeRealmSelector";
import { usePlayResourceSound } from "../../../../../hooks/useUISound";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { createOffer } from "@/ui/components/navigation/Config";
import { TravelInfo } from "@/ui/components/resources/ResourceWeight";
import { useDojo } from "@/hooks/context/DojoContext";

interface FastCreateOfferPopupProps {
  resourceId?: number;
  isBuy?: boolean;
  marketplaceMode?: boolean;
  directOfferRealmId?: bigint;
  onClose: () => void;
  onCreate: () => void;
  show: boolean;
}

export const FastCreateOfferPopup = ({
  resourceId = 1,
  isBuy,
  onClose,
  marketplaceMode,
  directOfferRealmId,
  show,
}: FastCreateOfferPopupProps) => {
  const [selectedResourceIdsGive, setSelectedResourceIdsGive] = useState<number[]>([]);
  const [selectedResourceIdsGet, setSelectedResourceIdsGet] = useState<number[]>([]);
  const [selectedResourcesGiveAmounts, setSelectedResourcesGiveAmounts] = useState<Record<number, number>>({});
  const [selectedResourcesGetAmounts, setSelectedResourcesGetAmounts] = useState<Record<number, number>>({});
  const [canCarry, setCanCarry] = useState(false);
  const [selectedRealmId, setSelectedRealmId] = useState<bigint | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const {
    account: { account },
    setup: {
      systemCalls: { create_order },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { getRealmEntityIdFromRealmId } = useRealm();

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

  useEffect(() => {
    if (directOfferRealmId) {
      setSelectedRealmId(directOfferRealmId);
    }
  }, [directOfferRealmId]);

  const createOrder = () => {
    const selectedRealmEntityId = selectedRealmId ? getRealmEntityIdFromRealmId(selectedRealmId) : 0;
    setIsLoading(true);
    if (!nextBlockTimestamp) return;
    create_order({
      signer: account,
      maker_id: realmEntityId,
      maker_gives_resources: selectedResourceIdsGive.flatMap((id) => [
        id,
        multiplyByPrecision(selectedResourcesGiveAmounts[id]),
      ]),
      taker_id: selectedRealmEntityId || 0,
      taker_gives_resources: selectedResourceIdsGet.flatMap((id) => [
        id,
        multiplyByPrecision(selectedResourcesGetAmounts[id]),
      ]),
      expires_at: nextBlockTimestamp + ONE_MONTH,
    }).finally(() => {
      setIsLoading(false);
      onClose();
    });
  };

  return (
    <OSWindow title={createOffer} onClick={onClose} show={show} width="450px">
      <div className="flex flex-col items-center p-2 overflow-auto">
        <SelectResourcesAmountPanel
          selectedResourceIdsGive={selectedResourceIdsGive}
          selectedResourcesGiveAmounts={selectedResourcesGiveAmounts}
          setSelectedResourceIdsGive={setSelectedResourceIdsGive}
          setSelectedResourcesGiveAmounts={setSelectedResourcesGiveAmounts}
          selectedResourceIdsGet={selectedResourceIdsGet}
          selectedResourcesGetAmounts={selectedResourcesGetAmounts}
          setSelectedResourceIdsGet={setSelectedResourceIdsGet}
          setSelectedResourcesGetAmounts={setSelectedResourcesGetAmounts}
          selectedRealmId={selectedRealmId}
          setSelectedRealmId={setSelectedRealmId}
          marketplaceMode={marketplaceMode}
          setCanCarry={setCanCarry}
        />
      </div>
      <div className="flex justify-between m-2  text-xxs">
        <Button
          className="!px-[6px] !py-[2px] w-full"
          disabled={!canCarry}
          isLoading={isLoading}
          onClick={() => {
            createOrder();
          }}
          size="md"
          variant={"primary"}
        >
          {selectedRealmId ? "Create Direct Offer" : "Create Order"}
        </Button>
      </div>
    </OSWindow>
  );
};

const SelectResourcesAmountPanel = ({
  selectedResourceIdsGive,
  selectedResourceIdsGet,
  selectedResourcesGiveAmounts,
  selectedResourcesGetAmounts,
  setSelectedResourceIdsGive,
  setSelectedResourceIdsGet,
  setSelectedResourcesGiveAmounts,
  setSelectedResourcesGetAmounts,
  selectedRealmId,
  setSelectedRealmId,
  marketplaceMode,
  setCanCarry,
}: {
  selectedResourceIdsGive: number[];
  selectedResourceIdsGet: number[];
  selectedResourcesGiveAmounts: Record<number, number>;
  selectedResourcesGetAmounts: Record<number, number>;
  setSelectedResourceIdsGive: (selectedResourceIdsGive: number[]) => void;
  setSelectedResourceIdsGet: (selectedResourceIdsGet: number[]) => void;
  setSelectedResourcesGiveAmounts: (selectedResourcesGiveAmounts: Record<number, number>) => void;
  setSelectedResourcesGetAmounts: (selectedResourcesGetAmounts: Record<number, number>) => void;
  selectedRealmId: bigint | undefined;
  setSelectedRealmId: (selectedRealmId: bigint) => void;
  marketplaceMode?: boolean;
  setCanCarry: (canCarryResources: boolean) => void;
}) => {
  const { realmEntityId } = useRealmStore();

  const { getBalance } = useResourceBalance();
  const { playResourceSound } = usePlayResourceSound();

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
    playResourceSound(unselectedResources[0].id);
  };

  const addResourceGet = () => {
    setSelectedResourceIdsGet([...selectedResourceIdsGet, unselectedResources[0].id]);
    setSelectedResourcesGetAmounts({
      ...selectedResourcesGetAmounts,
      [unselectedResources[0].id]: 1,
    });
    playResourceSound(unselectedResources[0].id);
  };

  return (
    <>
      <div className="grid w-full grid-cols-9 gap-2 p-2 relative">
        <div className="flex flex-col items-center col-span-4 space-y-2">
          <Headline className="mb-2">You Sell</Headline>
          {selectedResourceIdsGive.map((id, index) => {
            const resource = getBalance(realmEntityId, id);
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
                {id !== ResourcesIds.Lords || !marketplaceMode ? (
                  <ListSelect
                    className="w-full ml-2"
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
                      playResourceSound(value);
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
          {!marketplaceMode && (
            <Button
              className="w-full"
              variant="primary"
              size="md"
              onClick={() => {
                addResourceGive();
              }}
            >
              Add Resource
            </Button>
          )}
        </div>
        <div className="flex items-center justify-center self-end">
          <Button
            onClick={() => {
              swapResources();
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M17.1827 20.0928C18.148 20.0928 18.8871 19.8394 19.4 19.3326C19.9068 18.8318 20.1602 18.0987 20.1602 17.1334V6.76207C20.1602 5.80277 19.9068 5.07274 19.4 4.57197C18.8871 4.06517 18.148 3.81177 17.1827 3.81177H6.84758C5.88224 3.81177 5.14617 4.06517 4.63937 4.57197C4.13257 5.07877 3.87917 5.8088 3.87917 6.76207V17.1334C3.87917 18.0927 4.13257 18.8257 4.63937 19.3326C5.14617 19.8394 5.88224 20.0928 6.84758 20.0928H17.1827Z"
                className="fill-gold"
              />
              <path
                d="M16.6089 12.5008C16.7824 12.3402 16.8691 12.1493 16.8691 11.928C16.8691 11.7154 16.7824 11.5288 16.6089 11.3683L14.41 9.24002C14.2798 9.11418 14.1259 9.05127 13.948 9.05127C13.7746 9.05127 13.6336 9.10985 13.5252 9.227C13.4124 9.33981 13.356 9.48517 13.356 9.66307C13.356 9.8453 13.4232 9.99717 13.5577 10.1187L14.2863 10.8021L14.9564 11.3032L9.18179 11.3032L9.85188 10.8021L10.5805 10.1187C10.715 9.99719 10.7822 9.84533 10.7822 9.66309C10.7822 9.48519 10.7258 9.33984 10.6131 9.22702C10.5046 9.10987 10.3637 9.05129 10.1902 9.05129C10.0124 9.05129 9.85839 9.11421 9.72827 9.24004L7.52932 11.3683C7.35583 11.5289 7.26909 11.7154 7.26909 11.928C7.26909 12.1493 7.35583 12.3402 7.52932 12.5008L9.72827 14.6226C9.85839 14.7484 10.0124 14.8113 10.1902 14.8113C10.3637 14.8113 10.5046 14.7549 10.6131 14.6421C10.7258 14.5249 10.7822 14.3752 10.7822 14.193C10.7822 14.0064 10.715 13.8546 10.5805 13.7374L9.83887 13.0605L9.18179 12.5594L14.9564 12.5593L14.2994 13.0605L13.5577 13.7374C13.4232 13.8545 13.356 14.0064 13.356 14.193C13.356 14.3752 13.4124 14.5249 13.5252 14.6421C13.6336 14.7549 13.7746 14.8113 13.948 14.8113C14.1259 14.8113 14.2798 14.7484 14.41 14.6225L16.6089 12.5008Z"
                fill="black"
              />
            </svg>
          </Button>
        </div>
        <div className="flex flex-col items-center col-span-4 space-y-2">
          <Headline className="mb-2">You Buy</Headline>
          {selectedResourceIdsGet.map((id, index) => {
            const resource = getBalance(realmEntityId, id);
            let options = [resources.find((res) => res.id === id), ...unselectedResources] as any;
            options = options.map((res: any) => {
              const bal = getBalance(realmEntityId, res.id);
              return {
                id: res.id,
                label: (
                  <ResourceCost
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedResourcesGetAmounts({
                        ...selectedResourcesGetAmounts,
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
                {id !== ResourcesIds.Lords || !marketplaceMode ? (
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
                      playResourceSound(value);
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
          {!marketplaceMode && (
            <Button
              className="w-full"
              variant="primary"
              size="md"
              onClick={() => {
                addResourceGet();
              }}
            >
              Add Resource
            </Button>
          )}
        </div>
      </div>
      <TravelInfo
        entityId={realmEntityId}
        resources={selectedResourceIdsGet.map((resourceId) => ({
          resourceId,
          amount: selectedResourcesGetAmounts[resourceId],
        }))}
        setCanCarry={setCanCarry}
      ></TravelInfo>
      {!marketplaceMode && (
        <TradeRealmSelector selectedRealmId={selectedRealmId} setSelectedRealmId={setSelectedRealmId} />
      )}
    </>
  );
};
