import { starknetKeccak } from "@dojoengine/torii-client";
import { useMemo } from "react";

export const DEFAULT_TAB: Tab = { name: "Global", address: "0x0", displayed: true };

export interface Tab {
  name: string;
  address: string;
  numberOfMessages?: number;
  displayed: boolean;
}

export const getMessageKey = (addressOne: string | bigint, addressTwo: string | bigint) => {
  if (typeof addressOne === "string") {
    addressOne = BigInt(addressOne);
  }

  if (typeof addressTwo === "string") {
    addressTwo = BigInt(addressTwo);
  }

  const sortedAddresses = [addressOne, addressTwo].sort((a, b) => Number(a) - Number(b));

  return starknetKeccak(Buffer.from(sortedAddresses.join("")));
};

export const ChatTab = ({
  tab,
  changeTabs,
  selected,
  removeTab,
}: {
  tab: Tab;
  changeTabs: (tab: string | undefined, address: string, fromSelector: boolean) => void;
  selected: boolean;
  removeTab: (address: string) => void;
}) => {
  const userName = useMemo(() => {
    if (tab.name.length > 8) return `${tab.name.slice(0, 8)}...`;
    return tab.name;
  }, [tab]);

  return (
    <div className="relative flex" style={{ zIndex: 1 }}>
      <div
        className={`text-sm h-6 w-24 px-2 text-center self-center rounded-t bg-hex-bg ${
          selected ? "bg-black/70" : "bg-black/5"
        } mr-1 flex flex-row justify-between items-center relative`}
        style={{ zIndex: 2 }}
        onClick={() => changeTabs(tab.name, tab.address, false)}
      >
        {userName}
        {tab.name !== "Global" && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              removeTab(tab.address);
            }}
            className="self-center text-xs font-bold w-4"
          >
            X
          </div>
        )}
      </div>
    </div>
  );
};
