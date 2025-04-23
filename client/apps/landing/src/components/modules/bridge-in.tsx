import { execute } from "@/hooks/gql/execute";
import { useEntities } from "@/hooks/helpers/use-entities";
import { useResourceBalance } from "@/hooks/helpers/use-resources";
import { GET_CAPACITY_SPEED_CONFIG } from "@/hooks/query/capacity-config";
import { useLords } from "@/hooks/use-lords";
import { useTravel } from "@/hooks/use-travel";
import { displayAddress } from "@/lib/utils";
import { calculateDonkeysNeeded, divideByPrecision, getTotalResourceWeightKg } from "@bibliothecadao/eternum";
import { ADMIN_BANK_ENTITY_ID, Resources, ResourcesIds, resources } from "@bibliothecadao/types";
import { useAccount, useBalance } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { InfoIcon, Loader, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { TypeP } from "../typography/type-p";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { getResourceAddresses } from "../ui/utils/addresses";
import { BridgeFees } from "./bridge-fees";

export const BridgeIn = () => {
  const { address } = useAccount();
  const [realmEntityId, setRealmEntityId] = useState<number>();

  const { getBalance, isLoading: isResourcesLoading } = useResourceBalance({ entityId: realmEntityId });
  const { data } = useQuery({
    queryKey: ["capacitySpeedConfig"],
    queryFn: () => execute(GET_CAPACITY_SPEED_CONFIG),
    refetchInterval: 10_000,
  });

  const donkeyConfig = useMemo(
    () => ({
      capacity: Number(data?.s1EternumWorldConfigModels?.edges?.[0]?.node?.capacity_config?.donkey_capacity ?? 0),
      speed: data?.s1EternumWorldConfigModels?.edges?.[0]?.node?.speed_config?.donkey_sec_per_km ?? 0,
    }),
    [data],
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
  const { computeTravelTime } = useTravel(
    Number(ADMIN_BANK_ENTITY_ID),
    Number(realmEntityId!),
    donkeyConfig.speed,
    true,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResourceIds, setSelectedResourceIds] = useState<number[]>([ResourcesIds.Lords]);
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState<{ [key: string]: number }>({
    [ResourcesIds.Lords]: 0,
  });
  const [resourceAddresses, setResourceAddresses] = useState<{ [key: string]: [number, string] }>({});
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

  const { playerStructures } = useEntities();

  const travelTime = useMemo(() => {
    if (realmEntityId) {
      return computeTravelTime(Number(ADMIN_BANK_ENTITY_ID), Number(realmEntityId!), donkeyConfig.speed, true);
    } else {
      return 0;
    }
  }, [computeTravelTime, realmEntityId]);

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
  }, [orderWeightKg, donkeyConfig.capacity]);

  const donkeyBalance = getBalance(ResourcesIds.Donkey);

  useEffect(() => {
    const fetchAddresses = async () => {
      const addresses = getResourceAddresses();
      setResourceAddresses(addresses);
    };
    fetchAddresses();
  }, []);

  useEffect(() => {
    if (selectedResourceIds.length === 0) {
      addResourceGive();
    }
  }, [selectedResourceIds]);

  const onBridgeIntoRealm = async () => {
    console.log("implement bridge inside game client");
  };

  const [isFeesOpen, setIsFeesOpen] = useState(false);

  return (
    <>
      <div className="max-w-md flex flex-col gap-3 relative max-h-[calc(75vh-100px)] overflow-y-auto p-3">
        <TypeP>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4 text-gold border-b border-gold/20 pb-2">
              Bridge Resources Into Your Realm
            </h2>

            <div className="flex flex-col gap-4 bg-gold/5 p-4 rounded-lg border border-gold/10">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gold/20 text-gold font-semibold text-sm">
                    1
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-gold/90">Bridge Assets into the Game</h3>
                  <p className="text-sm opacity-80">
                    Bridge your ERC20 assets, resources and lords from your Starknet wallet into the Eternum game.
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
                  <h3 className="font-semibold text-gold/90">Complete Claim</h3>
                  <p className="text-sm opacity-80">
                    Complete the claim on your Realm in the{" "}
                    <a
                      href="https://eternum.realms.world/"
                      target="_blank"
                      className="text-gold underline hover:text-gold/80 transition-colors"
                    >
                      <span className="font-bold">game</span>
                    </a>{" "}
                    by checking the <span className="font-bold">Resource Arrivals (Donkeys)</span> tab in the game.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TypeP>
        <hr />
        <div className="flex justify-between">
          <div className="flex flex-col ">
            <div className="text-xs uppercase mb-1 ">From Wallet</div>
            <div>{displayAddress(address || "")}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase mb-1">To Realm</div>

            <Select onValueChange={(value) => setRealmEntityId(Number(value))}>
              <SelectTrigger
                className={
                  "w-full " +
                  (!realmEntityId
                    ? "bg-dark-brown dark:[background:linear-gradient(45deg,#1a1311,#1a1311)_padding-box,conic-gradient(from_var(--border-angle),#8b7355_80%,_#c6a366_86%,_#e5c088_90%,_#c6a366_94%,_#8b7355)_border-box] border border-transparent animate-border [background:linear-gradient(45deg,#ffffff,#ffffff)_padding-box,conic-gradient(from_var(--border-angle),#8b7355_80%,_#c6a366_86%,_#e5c088_90%,_#c6a366_94%,_#8b7355)_border-box]"
                    : "border-gold/15")
                }
              >
                {address ? (
                  <SelectValue placeholder="Select Structure To Transfer" />
                ) : (
                  <div> -- Connect your wallet --</div>
                )}
              </SelectTrigger>
              <SelectContent>
                {playerStructures?.length
                  ? playerStructures.map((structure) => {
                      return (
                        <SelectItem key={structure.realmId} value={structure.entityId.toString()}>
                          #{structure.realmId} - {structure.name}
                        </SelectItem>
                      );
                    })
                  : "No Structure settled in Eternum"}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedResourceIds.map((id, index) => (
          <ResourceInputRow
            key={`${id}-${index}`}
            id={id}
            index={index}
            selectedResourceIds={selectedResourceIds}
            setSelectedResourceIds={setSelectedResourceIds}
            selectedResourceAmounts={selectedResourceAmounts}
            setSelectedResourceAmounts={setSelectedResourceAmounts}
            unselectedResources={unselectedResources}
            resourceAddress={
              resourceAddresses[ResourcesIds[id].toLocaleUpperCase() as keyof typeof resourceAddresses]?.[1]
            }
            realmEntityId={realmEntityId}
          />
        ))}

        <Button variant="outline" size="sm" onClick={() => addResourceGive()} className="mb-2 py-2">
          <Plus className="h-4 w-4 mr-2" /> Add Resource
        </Button>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <div>Time to Transfer</div>
            <div>{travelTimeInHoursAndMinutes(travelTime ?? 0)}</div>
          </div>
          <div className={"flex justify-between mb-3 " + (donkeysNeeded > donkeyBalance ? "text-destructive" : "")}>
            <div>
              Donkeys Burnt
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="ml-2 w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-background border rounded p-2 max-w-64 text-gold">
                    Donkeys are required on your Realm to transport the resources to the bank. Finish the starting
                    quests in game for free donkeys.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              {donkeysNeeded} /{" "}
              {isResourcesLoading ? <Loader className="animate-spin pr-2" /> : divideByPrecision(donkeyBalance)}{" "}
              <ResourceIcon withTooltip={false} resource={"Donkey"} size="md" />
            </div>
          </div>
          <BridgeFees
            isOpen={isFeesOpen}
            onOpenChange={setIsFeesOpen}
            resourceSelections={selectedResourceAmounts}
            setResourceFees={setResourceFees}
            type="deposit"
          />
          <div className="flex flex-col gap-2 font-bold mt-5">
            <div className="flex justify-between">
              <div>Resources Received</div>
            </div>
            {Object.entries(selectedResourceAmounts).map(([id, amount]) => {
              if (amount === 0) return null;
              const resource = ResourcesIds[Number(id)];
              return (
                <div key={id} className="flex justify-between text-sm font-normal">
                  <div className="flex items-center gap-2">
                    <ResourceIcon resource={resource} size="sm" className="md:w-5 md:h-5" withTooltip={false} />{" "}
                    {resource}
                  </div>
                  <div>{(amount - Number(resourceFees.find((fee) => fee.id === id)?.totalFee ?? 0)).toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 rounded-b-xl bg-background p-4 mt-auto border-t border-gold/15">
        <Button
          className="w-full"
          disabled={
            isLoading ||
            !realmEntityId ||
            donkeyBalance < donkeysNeeded ||
            !Object.values(selectedResourceAmounts).some((amount) => amount > 0)
          }
          onClick={() => onBridgeIntoRealm()}
        >
          {isLoading && <Loader className="animate-spin pr-2" />}
          {isLoading ? "Transferring..." : !realmEntityId ? "Select a Realm" : "Initiate Transfer"}
        </Button>
      </div>
    </>
  );
};

const ResourceInputRow = ({
  id,
  index,
  selectedResourceIds,
  setSelectedResourceIds,
  selectedResourceAmounts,
  setSelectedResourceAmounts,
  unselectedResources,
  resourceAddress,
  realmEntityId,
}: {
  id: number;
  index: number;
  selectedResourceIds: number[];
  setSelectedResourceIds: (ids: number[]) => void;
  selectedResourceAmounts: { [key: string]: number };
  setSelectedResourceAmounts: (amounts: { [key: string]: number }) => void;
  unselectedResources: Resources[];
  resourceAddress: string;
  realmEntityId: number | undefined;
}) => {
  const { address } = useAccount();
  const { data: balance } = useBalance({ token: resourceAddress as `0x${string}`, address: address });
  const { lordsBalance } = useLords({ disabled: id !== ResourcesIds.Lords });

  const { getBalance } = useResourceBalance({ entityId: realmEntityId });

  const fetchedBalance =
    id !== ResourcesIds.Lords
      ? balance?.formatted.toString()
      : lordsBalance
        ? Number(formatEther(lordsBalance)).toFixed(2)
        : "0";
  return (
    <div key={id} className="rounded-lg p-3 border border-gold/15 shadow-lg bg-background flex gap-3 items-center">
      <div className="relative w-full">
        <Input
          type="text"
          placeholder="0.0"
          value={selectedResourceAmounts[id]}
          onChange={(e) => {
            setSelectedResourceAmounts({
              ...selectedResourceAmounts,
              [id]: Number(e.target.value),
            });
          }}
          className="bg-background text-2xl  outline-none h-10 border-none"
        />
        <div className="flex items-center gap-2 text-xxs absolute right-1 bottom-1">
          <span className="text-muted-foreground hover:text-gold text-xs">{fetchedBalance} </span>
          <Button
            className="uppercase px-1.5 text-xxs rounded-full h-6"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedResourceAmounts({
                ...selectedResourceAmounts,
                [id]: Number(fetchedBalance),
              });
            }}
          >
            Max
          </Button>
        </div>
      </div>

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
                  key={res.id}
                  disabled={Object.keys(selectedResourceAmounts).includes(res?.id.toString() ?? "")}
                  value={res?.id.toString() ?? ""}
                >
                  <div className="flex bg-background items-center gap-2">
                    {res?.trait && <ResourceIcon resource={res?.trait} size="md" />}
                    {res?.trait ?? ""}
                    <span className="text-muted-foreground text-xs">
                      {Intl.NumberFormat("en-US", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(divideByPrecision(getBalance(res?.id) ?? 0))}
                    </span>
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
  );
};
