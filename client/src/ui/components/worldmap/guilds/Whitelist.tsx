import { useState, useMemo } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import Button from "../../../elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";

import { useWhitelist, WhitelistElem } from "../../../../hooks/helpers/useGuilds";

interface WhitelistProps {
  guildEntityId: bigint | undefined;
  isOwner: boolean;
}

export const Whitelist = ({ guildEntityId, isOwner }: WhitelistProps) => {
  const {
    setup: {
      systemCalls: { whitelist_player },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [isWhitelisting, setIsWhitelisting] = useState(false);
  const [playerAddress, setPlayerAddress] = useState("");

  const { whitelist } = useWhitelist(guildEntityId!);

  const sortingParams = useMemo(() => {
    return [{ label: "Player", sortKey: "name", className: "w-1/6" }];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const whitelistPlayer = () => {
    setIsLoading(true);
    whitelist_player({ player_address: playerAddress, guild_entity_id: guildEntityId!, signer: account }).finally(() =>
      setIsLoading(false),
    );
  };

  return (
    <div className="flex flex-col">
      {isOwner && (
        <div className="flex my-3 px-4 justify-end">
          <Button isLoading={isLoading} onClick={() => setIsWhitelisting(!isWhitelisting)}>
            Invite player
          </Button>
        </div>
      )}
      {isWhitelisting && (
        <>
          <div className="flex justify-between px-3 items-baseline">
            Player address
            <TextInput
              className="border border-gold  !w-1/2 !flex-grow-0 !text-light-pink text-xs"
              value={playerAddress}
              onChange={(playerAddress) => setPlayerAddress(playerAddress)}
            />
            <Button onClick={whitelistPlayer} disabled={playerAddress == ""}>
              Confirm
            </Button>
          </div>
        </>
      )}

      <div className="flex flex-col">
        <SortPanel className="px-3 py-2">
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
        <div className="py-2">
          {sortWhitelist(whitelist, activeSort)?.map((whitelistElem: WhitelistElem) => {
            return (
              <div key={whitelistElem.address} className="flex px-3 text-xs">
                <p className="w-1/6 hover:text-white truncate">{whitelistElem.name}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export function sortWhitelist(whitelist: WhitelistElem[], activeSort: SortInterface): WhitelistElem[] | undefined {
  const sortedWhitelist = [...whitelist];

  if (activeSort.sort === "none") return sortedWhitelist;
  if (activeSort.sortKey === "name") {
    return sortedWhitelist.sort((a, b) => {
      return activeSort.sort === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });
  }
}
