import { configManager } from "@/dojo/setup";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useRealm } from "@/hooks/helpers/useRealms";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useBridgeAsset } from "@/hooks/useBridge";
import { useTravel } from "@/hooks/useTravel";
import { displayAddress, multiplyByPrecision } from "@/lib/utils";
import { ADMIN_BANK_ENTITY_ID, DONKEY_ENTITY_TYPE, Resources, resources, ResourcesIds } from "@bibliothecadao/eternum";
import { useAccount } from "@starknet-react/core";
import { InfoIcon, Loader, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TypeP } from "../typography/type-p";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/ResourceIcon";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { calculateDonkeysNeeded, getSeasonAddresses, getTotalResourceWeight } from "../ui/utils/utils";
import { BridgeFees } from "./bridge-fees";


export const BridgeIn = () => {
  const { address } = useAccount();
  const [realmEntityId, setRealmEntityId] = useState<number>();
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
  const { computeTravelTime } = useTravel();
  const { getRealmNameById } = useRealm();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResourceIds, setSelectedResourceIds] = useState<number[]>([]);
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState<{ [key: string]: number }>({});

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
        true,
      );
    } else {
      return 0;
    }
  }, [computeTravelTime, realmEntityId]);

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
  const { getBalance } = getResourceBalance();
  const donkeyBalance = useMemo(() => {
    if (realmEntityId) {
      return getBalance(Number(realmEntityId), ResourcesIds.Donkey);
    } else {
      return { balance: 0 };
    }
  }, [getBalance, realmEntityId]);

  const { bridgeIntoRealm } = useBridgeAsset();

  const onBridgeIntoRealm = async () => {
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
              amount: BigInt(amount * 10 ** 18),
            };
          }),
      );

      if (validResources.length === 0) {
        throw new Error("No valid resources selected");
      }

      await bridgeIntoRealm(validResources, ADMIN_BANK_ENTITY_ID, BigInt(realmEntityId!));
      setSelectedResourceIds([]);
      setSelectedResourceAmounts({});
    } catch (error) {
      console.error("Bridge into realm error:", error);
      toast.error("Failed to transfer resources");
    } finally {
      setIsLoading(false);
    }
  };

  const [isFeesOpen, setIsFeesOpen] = useState(false);

  return (
    <div className="max-w-md flex flex-col gap-3">
      <TypeP>
        Bridge resources and lords from your Starknet wallet into the Eternum game. You will have to complete the claim
        on your Realm in the{" "}
        <a href="https://eternum.realms.world/" target="_blank" className="text-gold underline">
          game
        </a>
        .
      </TypeP>
      <hr />
      <div className="flex justify-between">
        <div className="flex flex-col ">
          <div className="text-xs uppercase mb-1 ">From Wallet</div>
          <div>{displayAddress(address || "")}</div>
        </div>
        <div>
          <div className="text-xs uppercase mb-1">To Realm</div>

          <Select onValueChange={(value) => setRealmEntityId(Number(value))}>
            <SelectTrigger className="w-full border-gold/15">
              <SelectValue placeholder="Select Realm To Transfer" />
            </SelectTrigger>
            <SelectContent>
              {playerRealmsIdAndName.length
                ? playerRealmsIdAndName.map((realm) => {
                    return (
                      <SelectItem key={realm.realmId} value={realm.entityId.toString()}>
                        #{realm.realmId} - {realm.name}
                      </SelectItem>
                    );
                  })
                : "No Realms settled in Eternum"}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SelectResourceToBridge
        selectedResourceIds={selectedResourceIds}
        setSelectedResourceIds={setSelectedResourceIds}
        selectedResourceAmounts={selectedResourceAmounts}
        setSelectedResourceAmounts={setSelectedResourceAmounts}
        unselectedResources={unselectedResources}
        addResourceGive={addResourceGive}
      />

      <Button variant="outline" size="sm" onClick={() => addResourceGive()} className="mb-2">
        <Plus className="h-4 w-4 mr-2" /> Add Resource
      </Button>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <div>Time to Transfer</div>
          <div>{travelTimeInHoursAndMinutes(travelTime ?? 0)}</div>
        </div>
        <div className={"flex justify-between " + (donkeysNeeded > donkeyBalance.balance ? "text-destructive" : "")}>
          <div>
            Donkeys Burnt
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="ml-2 w-4 h-4" />
                </TooltipTrigger>
                <TooltipContent className="bg-background border rounded p-2 max-w-64 text-gold">
                  Donkeys are required on your Realm to transport the resources to the bank. Finish the starting quests
                  in game for free donkeys.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            {donkeysNeeded} / {donkeyBalance.balance} <ResourceIcon withTooltip={false} resource={"Donkey"} size="md" />
          </div>
        </div>
        <BridgeFees
          isOpen={isFeesOpen}
          onOpenChange={setIsFeesOpen}
          resourceSelections={selectedResourceAmounts}
          setResourceFees={setResourceFees}
          type="deposit"
        />
        <div className="flex flex-col gap-2 font-bold mt-3">
          <div className="flex justify-between">
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
      <Button
        disabled={
          isLoading || !realmEntityId || donkeyBalance.balance <= donkeysNeeded
        }
        onClick={() => onBridgeIntoRealm()}
      >
        {isLoading && <Loader className="animate-spin pr-2" />}
        {isLoading ? "Transferring..." : !realmEntityId ? "Select a Realm" : "Initiate Transfer"}
      </Button>
    </div>
  );
};

export const SelectResourceToBridge = ({
  selectedResourceAmounts,
  setSelectedResourceAmounts,
  selectedResourceIds,
  setSelectedResourceIds,
  unselectedResources,
  addResourceGive
}: {
  selectedResourceAmounts: { [key: string]: number };
  setSelectedResourceAmounts: (value: { [key: string]: number }) => void;
  selectedResourceIds: number[];
  setSelectedResourceIds: (value: number[]) => void;
  unselectedResources: Resources[];
  addResourceGive: () => void;
}) => {

  useEffect(() => {
    if (selectedResourceIds.length === 0) {
      addResourceGive();
    }
  }, [selectedResourceIds]);

  return (
    <>
      {selectedResourceIds.map((id, index) => (
        <div className="rounded-lg p-3 border border-gold/15 shadow-lg bg-dark-brown flex gap-3 items-center">
          <Input
            type="text"
            placeholder="0.0"
            value={selectedResourceAmounts[id]}
            onChange={(e) => {
              setSelectedResourceAmounts({
                ...selectedResourceAmounts,
                [id]: /*Math.min(divideByPrecision(resource?.balance || 0), */ Number(e.target.value),
              });
            }}
            className="bg-dark-brown text-2xl w-full outline-none h-10 border-none"
          />
          <Select
            onValueChange={(value) => {
              const updatedResourceIds = [...selectedResourceIds];
              updatedResourceIds[index] = Number(value);
              setSelectedResourceIds(updatedResourceIds);
              const { [id]: _, ...remainingAmounts } = selectedResourceAmounts;
              setSelectedResourceAmounts({
                ...remainingAmounts,
                [Number(value)]: 1,
              });
            }}
            value={selectedResourceIds[index]?.toString()}
          >
            <SelectTrigger className="w-[180px] border-gold/15">
              <SelectValue placeholder="Select Resource" />
            </SelectTrigger>
            <SelectContent>
              {[resources.find((res) => res.id === selectedResourceIds[index]), ...unselectedResources].map((res) => (
                <>
                  {res?.id && (
                    <SelectItem
                      key={res?.id}
                      disabled={Object.keys(selectedResourceAmounts).includes(res?.id.toString() ?? "")}
                      value={res?.id.toString() ?? ""}
                    >
                      <div className="flex items-center gap-2">
                        {res?.trait && <ResourceIcon resource={res?.trait} size="md" />}
                        {res?.trait ?? ""}
                      </div>
                    </SelectItem>
                  )}
                </>
              ))}
            </SelectContent>
          </Select>

          {selectedResourceIds.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const updatedResourceIds = selectedResourceIds.filter((_: any, i: any) => i !== index);
                setSelectedResourceIds(updatedResourceIds);
                const { [id]: _, ...updatedAmounts } = selectedResourceAmounts;
                setSelectedResourceAmounts(updatedAmounts);
              }}
              className="h-8 w-8 text-red-500 hover:text-red-600"
            >
              ×
            </Button>
          )}
        </div>
      ))}
    </>
  );
};
