import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import TextInput from "@/ui/elements/text-input";
import { toHexString } from "@bibliothecadao/eternum";
import { ContractAddress, Player } from "@bibliothecadao/types";
import React, { useMemo, useRef, useState } from "react";
import { displayAddress } from "../utils/utils";

interface SelectAddressProps {
  initialSelectedAddress: ContractAddress;
  players: Player[];
  onSelect: (player: Player | null) => void;
  className?: string;
}

export const SelectAddress: React.FC<SelectAddressProps> = ({
  players,
  onSelect,
  className,
  initialSelectedAddress,
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<Player | undefined>(() => {
    return players.find((p) => p.address.toString() === initialSelectedAddress?.toString());
  });

  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const searchStr = searchInput.toLowerCase();
      return player.name.toLowerCase().includes(searchStr) || player.address === selectedAddress?.address;
    });
  }, [players, searchInput]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else {
      setSearchInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (filteredPlayers.length > 0) {
        const selectedPlayer = filteredPlayers[0];
        setSelectedAddress(selectedPlayer);
        onSelect(selectedPlayer);
        setOpen(false);
      }
      setSearchInput("");
    } else {
      e.stopPropagation();
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      <Select
        open={open}
        onOpenChange={handleOpenChange}
        value={selectedAddress?.address.toString()}
        onValueChange={(value) => {
          const selectedPlayer = players.find((p) => p.address.toString() === value);
          setSelectedAddress(selectedPlayer);
          onSelect(selectedPlayer || null);
          setOpen(false);
          setSearchInput("");
        }}
      >
        <SelectTrigger className={className}>
          <SelectValue placeholder="Select a player" />
        </SelectTrigger>
        <SelectContent>
          <TextInput
            ref={inputRef}
            onChange={setSearchInput}
            placeholder="Filter players..."
            className="w-full"
            onKeyDown={handleKeyDown}
          />
          {filteredPlayers.map((player) => (
            <SelectItem key={player.address} value={player.address.toString()}>
              <div className="flex items-center">
                <span className="text-[1rem]">{`${player.name} (${displayAddress(toHexString(player.address))})`}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
