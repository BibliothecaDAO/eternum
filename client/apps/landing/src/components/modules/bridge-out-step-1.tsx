import { execute } from "@/hooks/gql/execute";
import { useEntities } from "@/hooks/helpers/use-entities";
import { useResourceBalance } from "@/hooks/helpers/use-resources";
import { GET_CAPACITY_SPEED_CONFIG } from "@/hooks/query/capacity-config";
import { useTravel } from "@/hooks/use-travel";
import { displayAddress } from "@/lib/utils";
import { calculateDonkeysNeeded, divideByPrecision, getTotalResourceWeightKg } from "@bibliothecadao/eternum";
import { ADMIN_BANK_ENTITY_ID, ResourcesIds, resources } from "@bibliothecadao/types";
import { TooltipContent, TooltipTrigger } from "@radix-ui/react-tooltip";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { InfoIcon, Loader, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { TypeP } from "../typography/type-p";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SelectSingleResource } from "../ui/select-resources";
import { Tooltip, TooltipProvider } from "../ui/tooltip";
import { BridgeFees } from "./bridge-fees";

export const BridgeOutStep1 = () => {
  const { address } = useAccount();
  const [realmEntityId, setRealmEntityId] = useState<string>("");

  const [isFeesOpen, setIsFeesOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["capacitySpeedConfig"],
    queryFn: () => execute(GET_CAPACITY_SPEED_CONFIG),
    refetchInterval: 10_000,
  });

  const donkeyConfig = useMemo(
    () => ({
      capacity: Number(data?.s1EternumWorldConfigModels?.edges?.[0]?.node?.capacity_config?.donkey_capacity ?? 0),
      speed: Number(data?.s1EternumWorldConfigModels?.edges?.[0]?.node?.speed_config?.donkey_sec_per_km ?? 0),
    }),
    [data],
  );

  const { computeTravelTime } = useTravel(
    Number(ADMIN_BANK_ENTITY_ID),
    Number(realmEntityId!),
    donkeyConfig.speed,
    true,
  );

  const [isLoading, setIsLoading] = useState(false);
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

  const { getBalance } = useResourceBalance({ entityId: Number(realmEntityId) });
  const donkeyBalance = useMemo(() => {
    if (realmEntityId) {
      return getBalance(ResourcesIds.Donkey);
    } else {
      return { balance: 0 };
    }
  }, [getBalance, realmEntityId]);

  const { playerStructures } = useEntities();

  const travelTime = useMemo(() => {
    if (realmEntityId) {
      return computeTravelTime(Number(ADMIN_BANK_ENTITY_ID), Number(realmEntityId!), donkeyConfig.speed, false);
    } else {
      return 0;
    }
  }, [selectedResourceId, realmEntityId, selectedResourceAmount]);

  const travelTimeInHoursAndMinutes = (travelTime: number) => {
    const hours = Math.floor(travelTime / 60);
    const minutes = travelTime % 60;
    return `${hours}h ${minutes}m`;
  };

  const orderWeightKg = useMemo(() => {
    const validSelections = Object.entries(selectedResourceAmounts).filter(([id, amount]) => amount > 0 && id != "NaN");
    if (validSelections.length > 0) {
      const totalWeight = getTotalResourceWeightKg(
        validSelections.map(([id, amount]) => ({
          resourceId: id as unknown as ResourcesIds,
          amount: amount,
        })),
      );
      return totalWeight;
    } else {
      return 0;
    }
  }, [selectedResourceAmounts]);

  const donkeysNeeded = useMemo(() => {
    if (orderWeightKg) {
      return calculateDonkeysNeeded(orderWeightKg);
    } else {
      return 0;
    }
  }, [orderWeightKg]);

  const onSendToBank = async () => {
    console.log("implement bridge inside game client");
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
                {address ? <SelectValue placeholder="Select Structure" /> : <div> -- Connect your wallet --</div>}
              </SelectTrigger>
              <SelectContent>
                {playerStructures?.map((structure) => {
                  return (
                    <SelectItem key={structure.realmId} value={structure.entityId.toString()}>
                      #{structure.realmId} - {structure.name}
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
              {donkeysNeeded} / {divideByPrecision(Number(donkeyBalance))}{" "}
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
            const resource = ResourcesIds[Number(id)];
            return (
              <div key={id} className="flex justify-between text-sm font-normal">
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={resource} size="md" /> {resource}
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

const SelectResourceRow = ({
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
