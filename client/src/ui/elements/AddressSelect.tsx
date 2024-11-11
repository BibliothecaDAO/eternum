import { useDojo } from "@/hooks/context/DojoContext";
import { getAddressNameFromEntityIds, useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useGetAllPlayers } from "@/hooks/helpers/useGetAllPlayers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { ContractAddress } from "@bibliothecadao/eternum";
import { HasValue, runQuery } from "@dojoengine/recs";
import { useMemo, useRef, useState } from "react";
import { displayAddress, toHexString } from "../utils/utils";
import TextInput from "./TextInput";

export const AddressSelect = ({
  addressList,
  selectedAddress,
  setSelectedAddress,
  search,
  className,
}: {
  addressList?: ContractAddress[];
  selectedAddress: ContractAddress;
  setSelectedAddress: (address: ContractAddress) => void;
  search?: boolean;
  className?: string;
}) => {
  const {
    account: { account },
    setup: {
      components: { Owner },
    },
  } = useDojo();

  const [open, setOpen] = useState(false);

  const { getAddressNameFromEntity } = useEntitiesUtils();

  const getPlayers = useGetAllPlayers();
  const [searchQuery, setSearchQuery] = useState("");

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && inputRef.current) {
      setSearchQuery("");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const players = useMemo(() => {
    if (addressList) {
      const entityIds = addressList.map((address) => {
        const entityId = runQuery([HasValue(Owner, { address: address })]);
        return Array.from(entityId)[0];
      });
      return getAddressNameFromEntityIds(entityIds, Owner, getAddressNameFromEntity);
    } else {
      return getPlayers();
    }
  }, [account.address, addressList]);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const searchStr = searchQuery.toLowerCase();
      return (
        player.addressName.toLowerCase().includes(searchStr) ||
        toHexString(player.address).toLowerCase().includes(searchStr)
      );
    });
  }, [players, searchQuery]);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      console.log({ filteredPlayers });
      if (filteredPlayers.length > 0) {
        setSelectedAddress(ContractAddress(filteredPlayers[0].address.toString()));
      }
      setSearchQuery("");
    } else {
      e.stopPropagation();
    }
  };

  return (
    <div className={`self-center text-gold text-center border border-gold rounded ${className}`}>
      {players.length > 0 && (
        <Select
          open={open}
          onOpenChange={handleOpenChange}
          value={}
          onValueChange={(a) => {
            setSelectedAddress(ContractAddress(a));
          }}
        >
          <SelectTrigger className="h-10 text-[1rem]">
            <SelectValue
              className="text-[1rem]"
              placeholder={`${players[0].addressName} (${displayAddress(toHexString(players[0].address || 0n))})`}
            />
          </SelectTrigger>
          <SelectContent className="text-[1rem]">
            <TextInput
              ref={inputRef}
              onChange={setSearchQuery}
              placeholder="Filter channels..."
              className="w-full"
              onKeyDown={handleKeyDown}
            />
            <div className="max-h-[200px] overflow-y-auto">
              {filteredPlayers.map((player, index) => (
                <SelectItem className="h-10 text-[1rem]" key={index} value={player.address.toString()}>
                  <h5 className="text-[1rem]">{`${player.addressName} (${displayAddress(
                    toHexString(player.address),
                  )})`}</h5>
                </SelectItem>
              ))}
            </div>
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
