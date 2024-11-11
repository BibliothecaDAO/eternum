import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import { useStructureByEntityId } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { AddressSelect } from "@/ui/elements/AddressSelect";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";
import { displayAddress, formatTime, getEntityIdFromKeys } from "@/ui/utils/utils";
import { ContractAddress, HYPERSTRUCTURE_CONFIG_ID, ID } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { CoOwnersWithTimestamp } from "./types";

export const CoOwners = ({ hyperstructureEntityId }: { hyperstructureEntityId: ID }) => {
  const [isChangingCoOwners, setIsChangingCoOwners] = useState(false);

  const coOwnersWithTimestamp = useMemo(() => {
    // Mock data for co-owners
    const mockCoOwners = [
      { address: ContractAddress("0x0"), percentage: 300 },
      { address: ContractAddress("0x0"), percentage: 300 },
      { address: ContractAddress("0x0"), percentage: 300 },
    ];

    return {
      coOwners: mockCoOwners,
      timestamp: Date.now() - 86400000, // 1 day ago
    };
  }, [hyperstructureEntityId]);

  return (
    <>
      {isChangingCoOwners ? (
        <ChangeCoOwners hyperstructureEntityId={hyperstructureEntityId} />
      ) : (
        <CoOwnersRows
          coOwnersWithTimestamp={coOwnersWithTimestamp}
          hyperstructureEntityId={hyperstructureEntityId}
          setIsChangingCoOwners={setIsChangingCoOwners}
        />
      )}
    </>
  );
};

const CoOwnersRows = ({
  coOwnersWithTimestamp,
  hyperstructureEntityId,
  setIsChangingCoOwners,
}: {
  coOwnersWithTimestamp: CoOwnersWithTimestamp | undefined;
  hyperstructureEntityId: ID;
  setIsChangingCoOwners: (isChangingCoOwners: boolean) => void;
}) => {
  const {
    account: { account },
    setup: {
      components: { Hyperstructure, HyperstructureConfig },
    },
  } = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const hyperstructureConfig = useMemo(() => {
    return getComponentValue(HyperstructureConfig, getEntityIdFromKeys([HYPERSTRUCTURE_CONFIG_ID]));
  }, [hyperstructureEntityId]);

  const hyperstructure = useComponentValue(Hyperstructure, getEntityIdFromKeys([BigInt(hyperstructureEntityId)]));

  const canUpdate = useMemo(() => {
    if (!hyperstructureConfig || !nextBlockTimestamp) return false;
    if (!hyperstructure) return true;
    if (ContractAddress(hyperstructure.last_updated_by) === ContractAddress(account.address)) {
      return (
        nextBlockTimestamp > hyperstructure.last_updated_timestamp + hyperstructureConfig.time_between_shares_change
      );
    } else {
      return true;
    }
  }, [hyperstructure, hyperstructureConfig, nextBlockTimestamp]);

  const structure = useStructureByEntityId(hyperstructureEntityId);

  const { getAddressName } = useRealm();

  const sortingParams = useMemo(() => {
    return [
      { label: "Name", sortKey: "name", className: "" },
      { label: "Address", sortKey: "address", className: "" },
      { label: "Percentage", sortKey: "percentage", className: "flex justify-end" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  return (
    <>
      <SortPanel className="px-3 py-2 grid grid-cols-3">
        {sortingParams.map(({ label, sortKey, className }) => (
          <SortButton
            className={className}
            key={sortKey}
            label={label}
            sortKey={sortKey}
            activeSort={activeSort}
            onChange={(_sortKey, _sort) => {
              setActiveSort({
                sortKey: _sortKey,
                sort: _sort,
              });
            }}
          />
        ))}
      </SortPanel>

      {coOwnersWithTimestamp?.coOwners.map((coOwner, index) => {
        const playerName = getAddressName(coOwner.address) || "Player not found";

        const isOwner = coOwner.address === ContractAddress(account.address);

        return (
          <div key={index} className={`flex mt-1 ${isOwner ? "bg-green/20" : ""} text-xxs text-gold`}>
            <div className={`flex relative group items-center text-xs px-2 p-1 w-full`}>
              <div className="flex w-full grid grid-cols-3">
                <div className="text-sm font-bold">{playerName}</div>
                <div className=" text-sm font-bold">{displayAddress(coOwner.address.toString(16))}</div>
                <div className="text-right">{coOwner.percentage / 100}%</div>
              </div>
            </div>
          </div>
        );
      })}
      {true && (
        <div
          onMouseEnter={() => {
            if (!canUpdate)
              setTooltip({
                content: `Wait ${formatTime(
                  Number(hyperstructureConfig?.time_between_shares_change) -
                    Number((nextBlockTimestamp || 0) - (hyperstructure?.last_updated_timestamp ?? 0)),
                )} to change`,
                position: "top",
              });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <Button
            onClick={() => {
              setIsChangingCoOwners(true);
            }}
            disabled={!canUpdate}
            className="w-full mt-4 bg-gold/20"
          >
            Change Co-Owners
          </Button>
        </div>
      )}
    </>
  );
};

const ChangeCoOwners = ({ hyperstructureEntityId }: { hyperstructureEntityId: ID }) => {
  const {
    account: { account },
    setup: {
      systemCalls: { set_co_owners },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const [newCoOwners, setNewCoOwners] = useState<
    {
      address: ContractAddress;
      percentage: number;
    }[]
  >([{ address: ContractAddress(account.address), percentage: 0 }]);

  const addCoOwner = () => {
    setNewCoOwners([...newCoOwners, { address: ContractAddress(account.address), percentage: 0 }]);
  };

  const setCoOwners = () => {
    setIsLoading(true);
    set_co_owners({
      signer: account,
      hyperstructure_entity_id: hyperstructureEntityId,
      co_owners: newCoOwners.map((coOwner) => ({ ...coOwner, percentage: coOwner.percentage * 100 })),
    });
    setIsLoading(false);
  };

  const removeCoOwner = (index: number) => {
    setNewCoOwners(newCoOwners.filter((_, i) => i !== index));
  };

  const hasDuplicates = useMemo(() => {
    return new Set(newCoOwners.map((coOwner) => coOwner.address)).size !== newCoOwners.length;
  }, [newCoOwners]);

  const totalPercentage = useMemo(() => {
    return newCoOwners.reduce((acc, curr) => acc + curr.percentage, 0);
  }, [newCoOwners]);

  return (
    <div className="h-full flex flex-col justify-between">
      <div>
        {newCoOwners.map((coOwner, index) => {
          const coOwnersExceptForThis = [...newCoOwners.slice(0, index), ...newCoOwners.slice(index + 1)];
          return (
            <div key={index} className="flex flex-row grid grid-cols-12 gap-2 mb-2">
              <AddressSelect
                className="col-span-8"
                setSelectedAddress={(val) => {
                  const updatedCoOwners = [...newCoOwners];
                  updatedCoOwners[index] = { ...coOwner, address: val };
                  setNewCoOwners(updatedCoOwners);
                  console.log({ val, newCoOwners, updatedCoOwners });
                }}
              />
              <NumberInput
                className="max-w-[10rem] col-span-3"
                key={index}
                value={newCoOwners[index].percentage}
                max={100 - coOwnersExceptForThis.reduce((acc, curr) => acc + curr.percentage, 0)}
                onChange={(value) => {
                  setNewCoOwners([
                    ...newCoOwners.slice(0, index),
                    { ...coOwner, percentage: value },
                    ...newCoOwners.slice(index + 1),
                  ]);
                }}
              />
              <Trash
                className="col-span-1 m-auto self-center w-6 h-6 fill-red/70 hover:scale-125 hover:animate-pulse duration-300 transition-all"
                onClick={() => removeCoOwner(index)}
              />
            </div>
          );
        })}
        <div className="flex justify-between">
          <div onClick={addCoOwner} className="flex items-center justify-center">
            <Plus className="w-6 h-6 fill-gold/70 hover:scale-125 hover:animate-pulse duration-300 transition-all" />
          </div>
          <div className={`text-sm ${totalPercentage === 100 ? "text-red" : ""}`}>{totalPercentage}%</div>
        </div>
      </div>
      <Button
        className="mb-2"
        disabled={newCoOwners.length === 0 || totalPercentage !== 100 || hasDuplicates}
        onClick={setCoOwners}
        isLoading={isLoading}
      >
        {`${hasDuplicates ? "Can't set the same person twice as co-owner" : "Set co-owners"}`}
      </Button>
    </div>
  );
};
