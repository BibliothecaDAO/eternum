import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { SelectAddress } from "@/ui/elements/select-address";
import { SortButton, SortInterface } from "@/ui/elements/sort-button";
import { SortPanel } from "@/ui/elements/sort-panel";
import { displayAddress } from "@/ui/utils/utils";
import {
  ContractAddress,
  formatTime,
  getAddressName,
  getStructure,
  ID,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { useDojo, usePlayers } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { CoOwnersWithTimestamp } from "./types";

export const CoOwners = ({
  hyperstructureEntityId,
  coOwnersWithTimestamp,
}: {
  hyperstructureEntityId: ID;
  coOwnersWithTimestamp: CoOwnersWithTimestamp | undefined;
}) => {
  const [isChangingCoOwners, setIsChangingCoOwners] = useState(false);

  return (
    <>
      {isChangingCoOwners ? (
        <ChangeCoOwners hyperstructureEntityId={hyperstructureEntityId} setIsChangingCoOwners={setIsChangingCoOwners} />
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
    setup: { components },
  } = useDojo();
  const { Hyperstructure, WorldConfig } = components;

  const setTooltip = useUIStore((state) => state.setTooltip);

  const { currentBlockTimestamp } = useBlockTimestamp();

  const hyperstructureConfig = useMemo(() => {
    return getComponentValue(WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
  }, [hyperstructureEntityId])?.hyperstructure_config;

  const hyperstructure = useComponentValue(Hyperstructure, getEntityIdFromKeys([BigInt(hyperstructureEntityId)]));

  const canUpdate = useMemo(() => {
    if (!hyperstructureConfig || !currentBlockTimestamp) return false;
    if (!hyperstructure) return true;
    if (ContractAddress(hyperstructure.last_updated_by) === ContractAddress(account.address)) {
      return (
        currentBlockTimestamp > hyperstructure.last_updated_timestamp + hyperstructureConfig.time_between_shares_change
      );
    } else {
      return true;
    }
  }, [hyperstructure, hyperstructureConfig, currentBlockTimestamp]);

  const structure = useMemo(
    () => getStructure(hyperstructureEntityId, ContractAddress(account.address), components),
    [hyperstructureEntityId, account.address, components],
  );

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
        const playerName = getAddressName(coOwner.address, components) || "Player not found";

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
      {structure?.isMine && (
        <div
          onMouseEnter={() => {
            if (!canUpdate)
              setTooltip({
                content: `Wait ${formatTime(
                  Number(hyperstructureConfig?.time_between_shares_change) -
                    Number((currentBlockTimestamp || 0) - (hyperstructure?.last_updated_timestamp ?? 0)),
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
            variant="primary"
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

const ChangeCoOwners = ({
  hyperstructureEntityId,
  setIsChangingCoOwners,
}: {
  hyperstructureEntityId: ID;
  setIsChangingCoOwners: (isChanging: boolean) => void;
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { set_co_owners },
    },
  } = useDojo();

  const players = usePlayers();
  const [isLoading, setIsLoading] = useState(false);
  const [newCoOwners, setNewCoOwners] = useState<
    {
      address: ContractAddress;
      percentage: number;
      id: number;
    }[]
  >([
    {
      address: ContractAddress(account.address),
      percentage: 100,
      id: 0,
    },
  ]);

  const [nextId, setNextId] = useState(1);

  const addCoOwner = () => {
    if (newCoOwners.length >= 10) return;
    setNewCoOwners([...newCoOwners, { address: ContractAddress(account.address), percentage: 0, id: nextId }]);
    setNextId(nextId + 1);
  };

  const setCoOwners = async () => {
    setIsLoading(true);
    // percentage is in precision 10_000
    await set_co_owners({
      signer: account,
      hyperstructure_entity_id: hyperstructureEntityId,
      co_owners: newCoOwners
        .filter((owner) => owner.percentage > 0)
        .map((coOwner) => ({
          address: coOwner.address,
          percentage: coOwner.percentage * 100,
        })),
    });
    setIsLoading(false);
    setIsChangingCoOwners(false);
  };

  const removeCoOwner = (id: number) => {
    setNewCoOwners(newCoOwners.filter((coOwner) => coOwner.id !== id));
  };

  const hasDuplicates = useMemo(() => {
    return new Set(newCoOwners.map((coOwner) => coOwner.address)).size !== newCoOwners.length;
  }, [newCoOwners]);

  const totalPercentage = useMemo(() => {
    return newCoOwners.reduce((acc, curr) => acc + curr.percentage, 0);
  }, [newCoOwners]);

  const hasCurrentUser = useMemo(() => {
    return newCoOwners
      .filter((owner) => owner.percentage > 0)
      .some((coOwner) => coOwner.address === ContractAddress(account.address));
  }, [newCoOwners, account.address]);

  return (
    <div className="h-full flex flex-col justify-between">
      <div>
        <div className="text-red text-center p-4 bg-red/10 mb-4">
          ⚠️ Important: You must set co-owners to start earning points. No points will be earned until co-owners are
          set!
        </div>
        {newCoOwners.map((coOwner) => {
          const coOwnersExceptForThis = newCoOwners.filter((co) => co.id !== coOwner.id);
          const maxValue = 100 - coOwnersExceptForThis.reduce((acc, curr) => acc + curr.percentage, 0);
          const value = coOwner.percentage;
          return (
            <div key={coOwner.id} className="flex flex-row grid grid-cols-12 gap-2 mb-2">
              <SelectAddress
                className="col-span-8"
                players={players}
                initialSelectedAddress={ContractAddress(account.address)}
                onSelect={(player) => {
                  if (player) {
                    setNewCoOwners(
                      newCoOwners.map((co) => (co.id === coOwner.id ? { ...co, address: player.address } : co)),
                    );
                  }
                }}
              />
              <NumberInput
                className="max-w-[10rem] col-span-3"
                value={value}
                max={maxValue}
                min={1}
                disabled={!coOwner.address}
                onChange={(value) => {
                  setNewCoOwners(newCoOwners.map((co) => (co.id === coOwner.id ? { ...co, percentage: value } : co)));
                }}
              />
              <Trash
                className="col-span-1 m-auto self-center w-6 h-6 fill-red/70 hover:scale-125 hover:animate-pulse duration-300 transition-all"
                onClick={() => removeCoOwner(coOwner.id)}
              />
            </div>
          );
        })}
        <div className="flex justify-between">
          <div onClick={addCoOwner} className="flex items-center justify-center">
            <Plus
              className={`w-6 h-6 fill-gold/70 ${
                newCoOwners.length >= 10
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:scale-125 hover:animate-pulse duration-300 transition-all"
              }`}
            />
          </div>
          <div className={`text-sm ${totalPercentage === 100 ? "text-red" : ""}`}>{totalPercentage}%</div>
        </div>
      </div>
      <Button
        variant="primary"
        className="my-2"
        disabled={newCoOwners.length === 0 || totalPercentage !== 100 || hasDuplicates || !hasCurrentUser}
        onClick={setCoOwners}
        isLoading={isLoading}
      >
        {hasDuplicates
          ? "Can't set the same person twice as co-owner"
          : !hasCurrentUser
            ? "You must include yourself as a co-owner"
            : totalPercentage !== 100
              ? "Total percentage must be 100%"
              : "Set co-owners (Required to earn points)"}
      </Button>
    </div>
  );
};
