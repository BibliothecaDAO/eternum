import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import { useMemo, useState } from "react";
import { TransferBetweenEntities } from "./TransferBetweenEntities";

export const TransferView = () => {
  const {
    account: { account },
  } = useDojo();

  const { playerRealms, playerStructures, otherRealms } = useEntities();

  const [guildOnly, setGuildOnly] = useState(false);

  const { getPlayersInPlayersGuild } = useGuilds();

  const playersInPlayersGuildAddress = useMemo(() => {
    return getPlayersInPlayersGuild(BigInt(account.address)).map((a) => BigInt(a.address));
  }, [account.address]);

  return (
    <TransferBetweenEntities
      filterBy={setGuildOnly}
      filtered={guildOnly}
      entitiesList={[
        { entities: playerRealms(), name: "Your Realms" },
        {
          entities: playerStructures().filter((structure) => structure.category === "Hyperstructure"),
          name: "Your Hyperstructures",
        },
        {
          entities: playerStructures().filter((structure) => structure.category === "FragmentMine"),
          name: "Your Fragment Mines",
        },
        {
          entities: otherRealms((a) =>
            guildOnly
              ? playersInPlayersGuildAddress.includes(a.owner.address)
              : !playersInPlayersGuildAddress.includes(a.owner.address),
          ),
          name: "Other Realms",
        },
      ]}
    />
  );
};
