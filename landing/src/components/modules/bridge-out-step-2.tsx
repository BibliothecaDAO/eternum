import { useEntities } from "@/hooks/helpers/useEntities";
import { donkeyArrivals } from "@/hooks/helpers/useResources";
import { useBridgeAsset } from "@/hooks/useBridge";
import { displayAddress } from "@/lib/utils";
import { ADMIN_BANK_ENTITY_ID, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/eternum";
import { useAccount } from "@starknet-react/core";
import { Loader } from "lucide-react";
import { useMemo, useState } from "react";
import { TypeP } from "../typography/type-p";
import { ShowSingleResource } from "../ui/SelectResources";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { getSeasonAddresses } from "../ui/utils/utils";
import { BridgeFees } from "./bridge-fees";

export const BridgeOutStep2 = () => {
  const { address } = useAccount();

  const { getOwnerArrivalsAtBank, getDonkeyInfo } = donkeyArrivals();
  const [donkeyEntityId, setDonkeyEntityId] = useState(0n);
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

  const { playerRealms } = useEntities();
  const realmEntityIds = useMemo(() => {
    return playerRealms.map((realm) => realm!.entity_id);
  }, [playerRealms]);

  const donkeysArrivals = useMemo(() => getOwnerArrivalsAtBank(realmEntityIds as number[]), [realmEntityIds]);
  const donkeyInfos = useMemo(() => {
    return donkeysArrivals.map((donkey) => getDonkeyInfo(donkey));
  }, [donkeysArrivals]);

  const { bridgeFinishWithdrawFromRealm } = useBridgeAsset();

  const onFinishWithdrawFromBank = async () => {
    if (selectedResourceId) {
      const resourceAddresses = await getSeasonAddresses();
      const selectedResourceName = ResourcesIds[selectedResourceId];
      const tokenAddress = resourceAddresses[selectedResourceName.toUpperCase() as keyof typeof resourceAddresses][1];
      try {
        setIsLoading(true);
        await bridgeFinishWithdrawFromRealm(tokenAddress as string, ADMIN_BANK_ENTITY_ID, donkeyEntityId);
      } finally {
        setDonkeyEntityId(0n);
        setSelectedResourceIds([]);
        setSelectedResourceAmounts({});
        setIsLoading(false);
      }
    }
  };
  const [isFeesOpen, setIsFeesOpen] = useState(false);

  return (
    <>
      <div className="max-w-md flex flex-col gap-3 max-h-[calc(75vh-100px)] overflow-y-auto p-3">
        <TypeP>
          Finalise the withdrawal of resources from your Realm in Eternum to your Starknet wallet. The bridge will close
          and you will be unable to withdraw 1 hour after the Season is won
        </TypeP>
        <hr />
        <div className="flex justify-between">
          <div className="flex flex-col min-w-40">
            <div className="text-xs uppercase mb-1 ">Select Donkey</div>
            <Select
              onValueChange={(value) => {
                if (value === null) {
                  setDonkeyEntityId(0n);
                  setSelectedResourceIds([]);
                  setSelectedResourceAmounts({});
                  return;
                }
                const currentDonkeyInfo = donkeyInfos?.find((donkey) => donkey.donkeyEntityId?.toString() === value);
                setDonkeyEntityId(BigInt(value));
                setSelectedResourceIds(
                  currentDonkeyInfo!.donkeyResources.map((resource) => resource.resourceId as never) ?? 0,
                );
                setSelectedResourceAmounts({
                  [currentDonkeyInfo!.donkeyResources[0].resourceId ?? 0]:
                    currentDonkeyInfo!.donkeyResources[0].amount / RESOURCE_PRECISION,
                });
              }}
            >
              <SelectTrigger className="w-full border-gold/15">
                <SelectValue placeholder="Select Donkey At Bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem key={"choose"} value={null}>
                  Choose a donkey
                </SelectItem>
                {donkeyInfos?.map((donkey) => (
                  <SelectItem key={donkey.donkeyEntityId} value={donkey.donkeyEntityId?.toString() ?? ""}>
                    Donkey Drove {donkey.donkeyEntityId}{" "}
                    {Number(donkey.donkeyArrivalTime) * 1000 <= Date.now()
                      ? "(Arrived!)"
                      : `(Arrives in ${Math.floor(
                          (Number(donkey.donkeyArrivalTime) * 1000 - Date.now()) / (1000 * 60 * 60),
                        )}h ${Math.floor(
                          ((Number(donkey.donkeyArrivalTime) * 1000 - Date.now()) / (1000 * 60)) % 60,
                        )}m)`}
                  </SelectItem>
                ))}
                {!donkeyInfos?.length && <div>No donkeys found at the bank</div>}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs uppercase mb-1">To</div>
            <div>{displayAddress(address || "")}</div>
          </div>
        </div>
        {selectedResourceIds.length > 0 && (
          <SelectResourceRow
            selectedResourceIds={selectedResourceIds}
            setSelectedResourceIds={(value: number[]) => setSelectedResourceIds(value as unknown as never[])}
            selectedResourceAmounts={selectedResourceAmounts}
            setSelectedResourceAmounts={setSelectedResourceAmounts}
          />
        )}
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
          disabled={(!selectedResourceAmount && !donkeyEntityId && !selectedResourceId) || isLoading}
          onClick={() => onFinishWithdrawFromBank()}
          className="w-full"
        >
          {isLoading && <Loader className="animate-spin pr-2" />}
          {isLoading ? "Sending to Wallet..." : "Send to Wallet (Final Step)"}
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
