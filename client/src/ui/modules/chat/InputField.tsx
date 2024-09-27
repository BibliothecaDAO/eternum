import { useDojo } from "@/hooks/context/DojoContext";
import { useGetAllPlayers } from "@/hooks/helpers/useEntities";
import TextInput from "@/ui/elements/TextInput";
import { toHexString, toValidAscii } from "@/ui/utils/utils";
import { ContractAddress } from "@bibliothecadao/eternum";
import { getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { useCallback, useMemo, useRef } from "react";
import { Signature, TypedData, WeierstrassSignatureType } from "starknet";
import { GLOBAL_CHANNEL } from "./Chat";
import { Tab } from "./ChatTab";

export const InputField = ({
  currentTab,
  addNewTab,
  setCurrentTab,
  salt,
}: {
  currentTab: Tab;
  addNewTab: (newTab: Tab) => void;
  setCurrentTab: (tab: Tab) => void;
  salt: bigint;
}) => {
  const {
    account: { account },
    setup: {
      components: { AddressName },
    },
    network: { toriiClient },
  } = useDojo();

  const getPlayers = useGetAllPlayers();
  const players = useMemo(
    () => getPlayers().filter((player) => ContractAddress(player.address) !== ContractAddress(account.address)),
    [getPlayers, account.address],
  );

  const input = useRef<string>("");

  const handleKeyPress = useCallback(
    (event: any) => {
      if (event.key !== "Enter") {
        return;
      }

      if (input.current.length === 0) return;

      const contentParser = new ContentParser();
      if (contentParser.isWhisper(input.current)) {
        const whisperDestination = contentParser.getWhisperDest(input.current);

        const player = players.find((player) => player.addressName === whisperDestination);
        if (!player) return;

        const newTab = {
          name: player.addressName!,
          address: toHexString(player.address),
          displayed: true,
        };

        addNewTab(newTab);
        setCurrentTab(newTab);
      } else {
        publish(input.current);
      }
    },
    [input.current, players, addNewTab, setCurrentTab],
  );

  const publish = useCallback(
    async (message: string) => {
      const recipientEntities = Array.from(
        runQuery([Has(AddressName), HasValue(AddressName, { name: BigInt("0x0") })]),
      );

      const recipientAddress = !!recipientEntities.length
        ? getComponentValue(AddressName, recipientEntities[0])?.address
        : currentTab.name === "Global"
          ? undefined
          : BigInt(currentTab.address);

      const channel = recipientAddress !== undefined ? toHexString(recipientAddress) : GLOBAL_CHANNEL;

      const messageInValidAscii = toValidAscii(message);
      const data = generateMessageTypedData(account.address, channel, messageInValidAscii, toHexString(salt));

      const signature: Signature = await account.signMessage(data as TypedData);

      await toriiClient.publishMessage(JSON.stringify(data), [
        toHexString((signature as WeierstrassSignatureType).r),
        toHexString((signature as WeierstrassSignatureType).s),
      ]);
    },
    [account, salt, toriiClient, currentTab.address],
  );
  return (
    <TextInput
      key={"chat-input"}
      className="border border-gold/40  !w-auto  text-gold"
      placeholder="Message"
      onChange={(value) => {
        input.current = value;
      }}
      onKeyDown={(e) => {
        handleKeyPress(e);
      }}
    />
  );
};

class ContentParser {
  isCommand(content: string): boolean {
    return content.startsWith("/");
  }

  isWhisper(content: string): boolean {
    if (!this.isCommand(content)) return false;
    return content[1] === "w";
  }

  getWhisperDest(content: string): string {
    return content.split(" ")[1];
  }
}

function generateMessageTypedData(
  identity: string,
  channel: string,
  content: string,
  salt: string,
  timestamp = Date.now(),
) {
  return {
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      "eternum-Message": [
        { name: "identity", type: "ContractAddress" },
        { name: "channel", type: "shortstring" },
        { name: "content", type: "string" },
        { name: "timestamp", type: "felt" },
        { name: "salt", type: "felt" },
      ],
    },
    primaryType: "eternum-Message",
    domain: {
      name: "Eternum",
      version: "1",
      chainId: "1",
      revision: "1",
    },
    message: {
      identity,
      channel,
      content,
      timestamp,
      salt,
    },
  };
}
