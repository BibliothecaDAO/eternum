import TextInput from "@/ui/elements/TextInput";
import { copyPlayerAddressToClipboard, displayAddress, sortItems } from "@/ui/utils/utils";
import { ID } from "@bibliothecadao/eternum";
import { useCallback, useMemo, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { GuildWhitelistAndName, useGuilds } from "../../../../hooks/helpers/useGuilds";
import Button from "../../../elements/Button";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";

interface WhitelistProps {
  guildEntityId: ID | undefined;
  isOwner: boolean;
}

type GuildWhitelistAndNameKeys = keyof GuildWhitelistAndName;
interface SortingParamGuildWhitelistAndName {
  label: string;
  sortKey: GuildWhitelistAndNameKeys;
  className?: string;
}

export const Whitelist = ({ guildEntityId, isOwner }: WhitelistProps) => {
  const {
    setup: {
      systemCalls: { whitelist_player, remove_player_from_whitelist },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [isWhitelisting, setIsWhitelisting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { useGuildWhitelist, getPlayerList } = useGuilds();
  const players = getPlayerList(guildEntityId!);
  const whitelist = useGuildWhitelist(guildEntityId!);

  const sortingParams: SortingParamGuildWhitelistAndName[] = useMemo(() => {
    return [
      { label: "Player", sortKey: "name", className: "col-span-1" },
      { label: "Address", sortKey: "playerAddress", className: "col-span-1" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const whitelistPlayer = (address: string) => {
    setIsLoading(true);
    whitelist_player({
      player_address_to_whitelist: address,
      guild_entity_id: guildEntityId!,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  const removePlayerFromWhitelist = useCallback((address: string) => {
    setIsLoading(true);
    remove_player_from_whitelist({
      player_address_to_remove: address,
      guild_entity_id: guildEntityId!,
      signer: account,
    }).finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex flex-col">
      {isOwner && (
        <div className="flex justify-end px-3 items-baseline">
          <div className="flex my-3 px-4 justify-end">
            <Button size="xs" isLoading={isLoading} onClick={() => setIsWhitelisting(!isWhitelisting)}>
              Invite player
            </Button>
          </div>
        </div>
      )}

      {isWhitelisting ? (
        <div className="flex flex-col">
          <TextInput
            placeholder="Search by name or address"
            className="border border-gold !text-light-pink text-xs my-2 w-1/4!"
            value={searchQuery}
            onChange={(query) => setSearchQuery(query)}
          />
          <SortPanel className="px-3 py-2 grid grid-cols-3 gap-4">
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

          <div className="flex flex-col p-3 space-y-2 overflow-y-auto">
            {players
              .filter(
                (player) =>
                  player.name.toLowerCase().startsWith(searchQuery.toLowerCase()) ||
                  player.address.toLowerCase().startsWith(searchQuery.toLowerCase()),
              )
              .map((player) => (
                <div key={player.address} className="grid grid-cols-3 gap-4 text-xs">
                  <p className="col-span-1 truncate">{player.name}</p>
                  <p className="col-span-1">{displayAddress(player.address)}</p>

                  <p className="col-span-1">
                    <Button
                      size="xs"
                      isLoading={isLoading}
                      onClick={() =>
                        player.isInvited ? removePlayerFromWhitelist(player.address) : whitelistPlayer(player.address)
                      }
                    >
                      {player.isInvited ? "Revoke" : "Invite"}
                    </Button>
                  </p>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <SortPanel className="px-3 py-2 grid grid-cols-3 gap-4">
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

          <div className="flex flex-col p-3 space-y-2 overflow-y-auto">
            {sortItems(whitelist, activeSort)?.map((guildWhitelist: GuildWhitelistAndName) => {
              return (
                <div key={guildWhitelist.guildWhitelist.address} className="grid grid-cols-3 gap-4 text-xs">
                  <p className="col-span-1 hover:text-white truncate">{guildWhitelist.name}</p>
                  <p
                    className="col-span-1 hover:text-white"
                    onClick={() =>
                      copyPlayerAddressToClipboard(guildWhitelist.guildWhitelist.address, guildWhitelist.name)
                    }
                  >
                    {displayAddress(guildWhitelist.playerAddress)}
                  </p>
                  {isOwner && (
                    <div className="col-span-1">
                      <Button
                        size="xs"
                        isLoading={isLoading}
                        onClick={() => removePlayerFromWhitelist(guildWhitelist.playerAddress)}
                      >
                        Revoke
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
