import { configManager } from "@/dojo/setup";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useRealm } from "@/hooks/helpers/useRealms";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useBridgeAsset } from "@/hooks/useBridge";
import { useTravel } from "@/hooks/useTravel";
import { displayAddress, multiplyByPrecision } from "@/lib/utils";
import {
  ADMIN_BANK_ENTITY_ID,
  DONKEY_ENTITY_TYPE,
  RESOURCE_PRECISION,
  ResourcesIds,
  resources,
} from "@bibliothecadao/eternum";
import { TooltipContent, TooltipTrigger } from "@radix-ui/react-tooltip";
import { useAccount } from "@starknet-react/core";
import { InfoIcon, Loader, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { TypeP } from "../typography/type-p";
import { SelectSingleResource } from "../ui/SelectResources";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipProvider } from "../ui/tooltip";
import {
  calculateDonkeysNeeded,
  divideByPrecision,
  getSeasonAddresses,
  getTotalResourceWeight,
} from "../ui/utils/utils";
import { BridgeFees } from "./bridge-fees";

function formatFee(fee: number) {
  return fee.toFixed(2);
}

export const BridgeOutStep1 = () => {
  const { address } = useAccount();
  const [realmEntityId, setRealmEntityId] = useState<string>("");

  const { getRealmNameById } = useRealm();
  const { computeTravelTime } = useTravel();
  const [isFeesOpen, setIsFeesOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const { bridgeStartWithdrawFromRealm } = useBridgeAsset();
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState<{ [key: string]: number }>({});
  const selectedResourceId = useMemo(() => selectedResourceIds[0] ?? 0, [selectedResourceIds]);
  const selectedResourceAmount = useMemo(
    () => selectedResourceAmounts[selectedResourceId] ?? 0,
    [selectedResourceAmounts, selectedResourceId],
  );

  const [resourceFees, setResourceFees] = useState<
    {
      id: string;
      velordsFee: string;
      seasonPoolFee: string;
      clientFee: string;
      bankFee: string;
      totalFee?: string;
    }[]
  >([]);

  const { getBalance } = getResourceBalance();
  const donkeyBalance = useMemo(() => {
    if (realmEntityId) {
      return getBalance(Number(realmEntityId), ResourcesIds.Donkey);
    } else {
      return { balance: 0 };
    }
  }, [getBalance, realmEntityId]);

  const { playerRealms } = useEntities();
  const playerRealmsIdAndName = useMemo(() => {
    return playerRealms.map((realm) => ({
      realmId: realm!.realm_id,
      entityId: realm!.entity_id,
      name: getRealmNameById(realm!.realm_id),
    }));
  }, [playerRealms]);

  const travelTime = useMemo(() => {
    if (realmEntityId) {
      return computeTravelTime(
        Number(ADMIN_BANK_ENTITY_ID),
        Number(realmEntityId!),
        configManager.getSpeedConfig(DONKEY_ENTITY_TYPE),
        false,
      );
    } else {
      return 0;
    }
  }, [selectedResourceId, realmEntityId, selectedResourceAmount]);

  const travelTimeInHoursAndMinutes = (travelTime: number) => {
    const hours = Math.floor(travelTime / 60);
    const minutes = travelTime % 60;
    return `${hours}h ${minutes}m`;
  };

  const orderWeight = useMemo(() => {
    const validSelections = Object.entries(selectedResourceAmounts).filter(([id, amount]) => amount > 0 && id != "NaN");
    if (validSelections.length > 0) {
      const totalWeight = getTotalResourceWeight(
        validSelections.map(([id, amount]) => ({
          resourceId: id as unknown as ResourcesIds,
          amount: multiplyByPrecision(amount),
        })),
      );
      return totalWeight;
    } else {
      return 0;
    }
  }, [selectedResourceAmounts]);

  const donkeysNeeded = useMemo(() => {
    if (orderWeight) {
      return calculateDonkeysNeeded(orderWeight);
    } else {
      return 0;
    }
  }, [orderWeight]);

  const onSendToBank = async () => {
    if (realmEntityId) {
      try {
        setIsLoading(true);

        const resourceAddresses = await getSeasonAddresses();
        const validResources = await Promise.all(
          Object.entries(selectedResourceAmounts)
            .filter(([id, amount]) => amount > 0)
            .map(async ([id, amount]) => {
              const tokenAddress =
                resourceAddresses[ResourcesIds[id].toLocaleUpperCase() as keyof typeof resourceAddresses][1];
              return {
                tokenAddress: tokenAddress as string,
                amount: BigInt(amount * RESOURCE_PRECISION),
              };
            }),
        );
        const tx = await bridgeStartWithdrawFromRealm(validResources, ADMIN_BANK_ENTITY_ID, BigInt(realmEntityId!));
        if (tx) {
          setSelectedResourceIds([]);
          setSelectedResourceAmounts({});
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      console.error("\n\n\n\n Realm does not exist in game yet. settle the realm!\n\n\n\n");
    }
  };

  return (
    <>
      <div className="max-w-md flex flex-col gap-3 max-h-[calc(75vh-100px)] overflow-y-auto p-3">
        <TypeP>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4 text-gold border-b border-gold/20 pb-2">
              Bridge Resources to Wallet
            </h2>

            <div className="flex flex-col gap-4 bg-gold/5 p-4 rounded-lg border border-gold/10">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gold/20 text-gold font-semibold text-sm">
                    1
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-gold/90">Bridge Resources</h3>
                  <p className="text-sm opacity-80">
                    Bridge resources from your Realms balance in-game to tradeable ERC20 assets in your Starknet wallet.
                    The first step is to send it to the bank.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gold/20 text-gold font-semibold text-sm">
                    2
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-gold/90">Complete Transfer</h3>
                  <p className="text-sm opacity-80">
                    Once the donkeys arrive at the bank, complete the second step ( the next section ) to receive
                    resources in your wallet.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gold/20 text-gold font-semibold text-sm">
                    ℹ️
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-gold/90">Important Note</h3>
                  <p className="text-sm opacity-80">
                    This bridge will only be available for withdrawals for up to 48 hours after the Season ends.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TypeP>
        <hr />
        <div className="flex justify-between">
          <div className="flex flex-col min-w-40">
            <div className="text-xs uppercase mb-1 ">From Realm</div>
            <Select onValueChange={(value) => setRealmEntityId(value)}>
              <SelectTrigger
                className={
                  "w-full " +
                  (!realmEntityId
                    ? "dark:bg-dark-brown dark:[background:linear-gradient(45deg,#1a1311,#1a1311)_padding-box,conic-gradient(from_var(--border-angle),#8b7355_80%,_#c6a366_86%,_#e5c088_90%,_#c6a366_94%,_#8b7355)_border-box] border border-transparent animate-border [background:linear-gradient(45deg,#ffffff,#ffffff)_padding-box,conic-gradient(from_var(--border-angle),#8b7355_80%,_#c6a366_86%,_#e5c088_90%,_#c6a366_94%,_#8b7355)_border-box]"
                    : "border-gold/40")
                }
              >
                {address ? <SelectValue placeholder="Select Settled Realm" /> : <div> -- Connect your wallet --</div>}
              </SelectTrigger>
              <SelectContent>
                {playerRealmsIdAndName.map((realm) => {
                  return (
                    <SelectItem key={realm.realmId} value={realm.entityId.toString()}>
                      #{realm.realmId} - {realm.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs uppercase mb-1">To Wallet</div>
            <div>{displayAddress(address || "")}</div>
          </div>
        </div>

        {Boolean(realmEntityId) && (
          <SelectResourceRow
            realmEntityId={Number(realmEntityId)}
            selectedResourceIds={selectedResourceIds}
            setSelectedResourceIds={(value: number[]) => setSelectedResourceIds(value as unknown as never[])}
            selectedResourceAmounts={selectedResourceAmounts}
            setSelectedResourceAmounts={setSelectedResourceAmounts}
          />
        )}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <div>Arrives in Bank</div>
            <div>{travelTimeInHoursAndMinutes(travelTime ?? 0)}</div>
          </div>
          <div className="flex justify-between mb-3">
            <div>
              Donkeys Burnt
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="ml-2 w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-background border rounded p-2 max-w-56">
                    Donkeys are required to transport the resources to the bank
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              {donkeysNeeded} / {divideByPrecision(donkeyBalance.balance)}{" "}
              <ResourceIcon resource={"Donkey"} size="md" />
            </div>
          </div>
          <BridgeFees
            isOpen={isFeesOpen}
            onOpenChange={setIsFeesOpen}
            resourceSelections={selectedResourceAmounts}
            setResourceFees={setResourceFees}
            type="withdrawal"
          />
          <div className="flex justify-between font-bold mt-3">
            <div>Total Amount Received</div>
          </div>
          {Object.entries(selectedResourceAmounts).map(([id, amount]) => {
            if (amount === 0) return null;
            const resourceName = ResourcesIds[id as keyof typeof ResourcesIds];
            return (
              <div key={id} className="flex justify-between text-sm font-normal">
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={resourceName} size="md" /> {resourceName}
                </div>
                <div>{(amount - Number(resourceFees.find((fee) => fee.id === id)?.totalFee ?? 0)).toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="sticky bottom-0 rounded-b-xl bg-background p-4 mt-auto border-t border-gold/15">
        <Button
          disabled={(!selectedResourceAmount && !selectedResourceId && !realmEntityId) || isLoading}
          className="w-full"
          onClick={() => onSendToBank()}
        >
          {isLoading && <Loader className="animate-spin pr-2" />}
          {isLoading ? "Sending to Bank..." : !realmEntityId ? "Select a Realm" : "Send to Bank (Step 1)"}
        </Button>
      </div>
    </>
  );
};

export const SelectResourceRow = ({
  realmEntityId,
  selectedResourceIds,
  setSelectedResourceIds,
  selectedResourceAmounts,
  setSelectedResourceAmounts,
}: {
  realmEntityId: number;
  selectedResourceIds: number[];
  setSelectedResourceIds: (value: number[]) => void;
  selectedResourceAmounts: { [key: string]: number };
  setSelectedResourceAmounts: (value: { [key: string]: number }) => void;
}) => {
  const unselectedResources = useMemo(
    () => resources.filter((res) => !selectedResourceIds.includes(res.id)),
    [selectedResourceIds],
  );
  const addResourceGive = () => {
    setSelectedResourceIds([...selectedResourceIds, unselectedResources[0].id]);
    setSelectedResourceAmounts({
      ...selectedResourceAmounts,
      [unselectedResources[0].id]: 1,
    });
  };

  return (
    <div className="grid grid-cols-0 gap-8 h-full">
      <div className=" bg-gold/10  h-auto border border-gold/40 flex flex-col items-center">
        <SelectSingleResource
          selectedResourceIds={selectedResourceIds}
          setSelectedResourceIds={setSelectedResourceIds}
          selectedResourceAmounts={selectedResourceAmounts}
          setSelectedResourceAmounts={setSelectedResourceAmounts}
          entity_id={realmEntityId}
        />
        <Button variant="default" className="mb-4" size="default" onClick={addResourceGive}>
          <Plus />
        </Button>
      </div>
    </div>
  );
};
