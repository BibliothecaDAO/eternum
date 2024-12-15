import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDojo } from "@/hooks/context/DojoContext";
import { useSyncEntity } from "@/hooks/helpers/use-sync-entity";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useDonkeyArrivals } from "@/hooks/helpers/useResources";
import { useBridgeAsset } from "@/hooks/useBridge";
import { displayAddress } from "@/lib/utils";
import { ADMIN_BANK_ENTITY_ID, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useAccount } from "@starknet-react/core";
import { ChevronDown, ChevronUp, Loader } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TypeP } from "../typography/type-p";
import { ShowSingleResource } from "../ui/SelectResources";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/ResourceIcon";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { getSeasonAddresses } from "../ui/utils/utils";
import { BridgeFees } from "./bridge-fees";

export const BridgeOutStep2 = () => {
  const { address } = useAccount();

  const dojo = useDojo();

  const { getOwnerArrivalsAtBank, getDonkeyInfo } = useDonkeyArrivals();

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState<{ [key: string]: number }>({});

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

  const { playerRealms } = useEntities();
  const realmEntityIds = useMemo(() => {
    return playerRealms.map((realm) => realm!.entity_id);
  }, [playerRealms]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const donkeysArrivals = useMemo(
    () => getOwnerArrivalsAtBank(realmEntityIds as number[]),
    [realmEntityIds, refreshTrigger],
  );

  const donkeyArrivalsEntityIds = useMemo(() => {
    return donkeysArrivals.map((entity) => {
      const position = getComponentValue(dojo.setup.components.Position, entity);
      return position?.entity_id;
    });
  }, [donkeysArrivals]) as number[];

  useSyncEntity(donkeyArrivalsEntityIds);

  const donkeyInfos = useMemo(() => {
    return donkeysArrivals.map((donkey) => getDonkeyInfo(donkey));
  }, [donkeysArrivals]);

  const { bridgeFinishWithdrawFromRealm } = useBridgeAsset();

  const onFinishWithdrawFromBank = async () => {
    if (selectedResourceIds.length) {
      const resourceAddresses = await getSeasonAddresses();
      const donkeyResources = selectedResourceIds.map((id, index) => ({
        tokenAddress: resourceAddresses[ResourcesIds[id].toUpperCase() as keyof typeof resourceAddresses][1],
        from_entity_id: Array.from(selectedDonkeys)[index],
      }));

      try {
        setIsLoading(true);
        const tx = await bridgeFinishWithdrawFromRealm(donkeyResources, ADMIN_BANK_ENTITY_ID);
        if (tx) {
          setSelectedDonkeys(new Set());
          setSelectedResourceIds([]);
          setSelectedResourceAmounts({});
        }
      } catch (e) {
        console.log(e);
      } finally {
        setIsLoading(false);
      }
    }
  };
  const [isFeesOpen, setIsFeesOpen] = useState(false);

  const [selectedDonkeys, setSelectedDonkeys] = useState<Set<bigint>>(new Set());
  const [isTableOpen, setIsTableOpen] = useState(false);

  const updateResourcesFromSelectedDonkeys = (selectedDonkeyIds: Set<bigint>) => {
    const allResources = Array.from(selectedDonkeyIds).flatMap(
      (id) => donkeyInfos.find((d) => d.donkeyEntityId && BigInt(d.donkeyEntityId) === id)?.donkeyResources || [],
    );

    setSelectedResourceIds(allResources.map((r) => r.resourceId as never));
    setSelectedResourceAmounts(
      allResources.reduce(
        (acc, r) => ({
          ...acc,
          [r.resourceId]: (acc[r.resourceId] || 0) + r.amount / RESOURCE_PRECISION,
        }),
        {},
      ),
    );
  };
  useEffect(() => {
    const newSelected = new Set<bigint>();

    donkeyInfos?.forEach((donkey) => {
      if (Number(donkey.donkeyArrivalTime) * 1000 <= Date.now()) {
        newSelected.add(BigInt(donkey.donkeyEntityId || 0));
      }
    });

    setSelectedDonkeys(newSelected);
    updateResourcesFromSelectedDonkeys(newSelected);
  }, [donkeyInfos]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 500); // Spin for 500ms
  };

  return (
    <>
      <div className="max-w-md flex flex-col gap-3 max-h-[calc(75vh-100px)] overflow-y-auto p-3">
        <TypeP>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4 text-gold border-b border-gold/20 pb-2">
              Finalize Bridge Withdrawal
            </h2>

            <div className="flex flex-col gap-4 bg-gold/5 p-4 rounded-lg border border-gold/10">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gold/20 text-gold">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-gold/90">Complete Withdrawal</h3>
                  <p className="text-sm opacity-80">
                    Finalize the withdrawal of resources from your Realm in Eternum to your Starknet wallet. Select a
                    donkey to withdraw resources from.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TypeP>
        <hr />
        <div className="mb-2">
          <div className="text-xs uppercase mb-1">Withdraw To</div>
          <div>{address ? displayAddress(address || "") : " -- Connect your wallet --"}</div>
        </div>
        <Collapsible open={isTableOpen} onOpenChange={setIsTableOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between p-2 hover:bg-gold/5 rounded-lg">
            <div>
              <span className="font-semibold">Select Donkeys</span>
              <span className="text-muted-foreground text-sm ml-2"> (optional)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefresh();
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isRefreshing ? "animate-spin" : ""}
                >
                  <path d="M21 2v6h-6"></path>
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                  <path d="M3 22v-6h6"></path>
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                </svg>
              </Button>
              {isTableOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="flex flex-col min-w-full mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Input
                        type="checkbox"
                        className="w-4"
                        checked={donkeyInfos?.length > 0 && selectedDonkeys.size === donkeyInfos.length}
                        onChange={() => {
                          const newSelected = new Set<bigint>();

                          if (selectedDonkeys.size !== donkeyInfos.length) {
                            donkeyInfos.forEach((donkey) => {
                              if (Number(donkey.donkeyArrivalTime) * 1000 <= Date.now()) {
                                newSelected.add(BigInt(donkey.donkeyEntityId || 0));
                              }
                            });
                          }
                          setSelectedDonkeys(newSelected);
                          updateResourcesFromSelectedDonkeys(newSelected);
                        }}
                      />
                    </TableHead>
                    <TableHead>Donkey ID</TableHead>
                    <TableHead className="flex-1 w-40">Resources</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donkeyInfos?.map((donkey) => {
                    const isArrived = Number(donkey.donkeyArrivalTime) * 1000 <= Date.now();
                    return (
                      <TableRow
                        key={donkey.donkeyEntityId}
                        className={`${
                          selectedDonkeys.has(BigInt(donkey.donkeyEntityId || 0)) ? "bg-gold/10" : ""
                        } hover:bg-gold/5 ${!isArrived ? "opacity-60" : "cursor-pointer"}`}
                        onClick={(e) => {
                          if (!isArrived) return;

                          const newSelected = new Set(selectedDonkeys);
                          const donkeyId = BigInt(donkey.donkeyEntityId || 0);
                          if (newSelected.has(donkeyId)) {
                            newSelected.delete(donkeyId);
                          } else {
                            newSelected.add(donkeyId);
                          }
                          setSelectedDonkeys(newSelected);
                          updateResourcesFromSelectedDonkeys(newSelected);
                        }}
                      >
                        <TableCell>
                          <Input
                            type="checkbox"
                            checked={selectedDonkeys.has(BigInt(donkey.donkeyEntityId || 0))}
                            className="w-4"
                          />
                        </TableCell>
                        <TableCell>#{donkey.donkeyEntityId}</TableCell>
                        <TableCell className="flex-grow">
                          {donkey.donkeyResources.map((resource) => (
                            <div key={resource.resourceId} className="flex items-center gap-1">
                              <ResourceIcon resource={ResourcesIds[resource.resourceId]} size="sm" />
                              <span className="text-sm">{(resource.amount / RESOURCE_PRECISION).toFixed(2)}</span>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          {Number(donkey.donkeyArrivalTime) * 1000 <= Date.now() ? (
                            <span className="text-green">Arrived</span>
                          ) : (
                            `Arrives in ${Math.floor(
                              (Number(donkey.donkeyArrivalTime) * 1000 - Date.now()) / (1000 * 60 * 60),
                            )}h ${Math.floor(
                              ((Number(donkey.donkeyArrivalTime) * 1000 - Date.now()) / (1000 * 60)) % 60,
                            )}m`
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!donkeyInfos?.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        No donkeys found at the bank
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
        <div className="flex flex-col gap-1">
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
          disabled={!selectedResourceIds.length || isLoading}
          onClick={() => onFinishWithdrawFromBank()}
          className="w-full"
        >
          {isLoading && <Loader className="animate-spin pr-2" />}
          {isLoading ? "Sending to Wallet..." : "Send to Wallet"}
        </Button>
      </div>
    </>
  );
};

export const SelectResourceRow = ({
  selectedResourceIds,
  setSelectedResourceIds,
  selectedResourceAmounts,
  setSelectedResourceAmounts,
}: {
  selectedResourceIds: number[];
  setSelectedResourceIds: (value: number[]) => void;
  selectedResourceAmounts: { [key: string]: number };
  setSelectedResourceAmounts: (value: { [key: string]: number }) => void;
}) => {
  return (
    <div className="grid grid-cols-0 gap-8 px-8 h-full">
      <div className=" bg-gold/10  h-auto border border-gold/40">
        <ShowSingleResource
          selectedResourceIds={selectedResourceIds}
          setSelectedResourceIds={setSelectedResourceIds}
          selectedResourceAmounts={selectedResourceAmounts}
          setSelectedResourceAmounts={setSelectedResourceAmounts}
          entity_id={0}
        />
      </div>
    </div>
  );
};
