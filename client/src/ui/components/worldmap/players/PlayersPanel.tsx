import { useDojo } from "@/hooks/context/DojoContext";
import { getEntitiesUtils, useGetAllPlayers } from "@/hooks/helpers/useEntities";
import useUIStore from "@/hooks/store/useUIStore";
import TextInput from "@/ui/elements/TextInput";
import { displayAddress, toHexString } from "@/ui/utils/utils";
import { ContractAddress } from "@bibliothecadao/eternum";
import { getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { useMemo, useState } from "react";

export const PlayersPanel = () => {
  const {
    setup: {
      components: { Structure, Owner },
    },
  } = useDojo();

  const setSelectedPlayer = useUIStore((state) => state.setSelectedPlayer);

  const [searchInput, setSearchInput] = useState("");

  const { getEntityName } = getEntitiesUtils();
  const getPlayers = useGetAllPlayers();

  const playersWithStructures = useMemo(() => {
    const players = getPlayers();
    const playersWithStructures = players.map((player) => {
      const structuresEntityIds = runQuery([
        Has(Structure),
        HasValue(Owner, { address: ContractAddress(player.address) }),
      ]);
      const structures = Array.from(structuresEntityIds).map((entityId) => {
        const structure = getComponentValue(Structure, entityId);
        if (!structure) return undefined;

        const structureName = getEntityName(structure.entity_id);
        return {
          structureName,
          structure,
        };
      });
      return {
        name: player.addressName,
        address: player.address,
        structures,
      };
    });
    return playersWithStructures;
  }, [getPlayers]);

  return (
    <>
      <div className="flex flex-col p-4">
        <TextInput
          placeholder="Search players/realms/structures..."
          onChange={(searchInput) => setSearchInput(searchInput)}
          className="my-2"
        />
        {playersWithStructures
          .filter(
            (player) =>
              player.name.toLowerCase().includes(searchInput.toLowerCase()) ||
              player.structures.some(
                (structure) => structure && structure.structureName.toLowerCase().includes(searchInput.toLowerCase()),
              ) ||
              toHexString(player.address).toLowerCase().includes(searchInput.toLowerCase()),
          )
          .map((player) => (
            <div
              key={player.address}
              onClick={() => setSelectedPlayer(player.address)}
              className="flex flex-col border border-gold/20 p-2 rounded-sm my-2"
            >
              <p>{player.name}</p>
              <p>{displayAddress(toHexString(player.address))}</p>
              <p>{player.structures.map((structure) => structure?.structureName).join(", ")}</p>
            </div>
          ))}
      </div>
    </>
  );
};
