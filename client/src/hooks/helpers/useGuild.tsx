import { useMemo } from "react";
import { Has, getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { useEntityQuery } from "@dojoengine/react";

export function useGetGuilds(): { guildIds: any[] } {
  const {
    setup: {
      components: { Guild },
    },
  } = useDojo();

  const guildEntityIds = useEntityQuery([Has(Guild)]);

  const guildIds: any[] = useMemo(
    () =>
      Array.from(guildEntityIds).map((entityId) => {
        const guild = getComponentValue(Guild, entityId) as any;
        console.log(guild, "guild");
        guild.entity_id = entityId;
        if (guild.guild_id.startsWith("0x")) {
          return guild.guild_id.replace("0x", "group:");
        }
        return "";
      }),
    [guildEntityIds],
  );

  return {
    guildIds,
  };
}
