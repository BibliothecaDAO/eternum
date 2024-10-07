import { useDojo } from "@/hooks/context/DojoContext";
import { getAddressNameFromEntityIds, getEntitiesUtils, useGetAllPlayers } from "@/hooks/helpers/useEntities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { ContractAddress } from "@bibliothecadao/eternum";
import { HasValue, runQuery } from "@dojoengine/recs";
import { useMemo } from "react";
import { displayAddress, toHexString } from "../utils/utils";

export const AddressSelect = ({
  addressList,
  setSelectedAddress,
  search,
  className,
}: {
  addressList?: ContractAddress[];
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

  const { getAddressNameFromEntity } = getEntitiesUtils();

  const getPlayers = useGetAllPlayers();

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

  return (
    <div className={`self-center text-gold text-center border border-gold rounded ${className}`}>
      {players.length > 0 && (
        <Select
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
            {players.map((player, index) => (
              <SelectItem className="h-10 text-[1rem]" key={index} value={player.address.toString()}>
                <h5 className="text-[1rem]">{`${player.addressName} (${displayAddress(
                  toHexString(player.address),
                )})`}</h5>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
