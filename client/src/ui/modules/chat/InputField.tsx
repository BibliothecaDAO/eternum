import { useDojo } from "@/hooks/context/DojoContext";
import { useGetOtherPlayers } from "@/hooks/helpers/useGetAllPlayers";
import TextInput from "@/ui/elements/TextInput";
import { toHexString, toValidAscii } from "@/ui/utils/utils";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useCallback, useMemo, useRef } from "react";
import { Signature } from "starknet";
import { GLOBAL_CHANNEL, GLOBAL_CHANNEL_KEY } from "./constants";
import { Tab } from "./types";

export const InputField = ({ currentTab, salt }: { currentTab: Tab; salt: bigint }) => {
  const {
    account: { account },
    setup: {
      components: { AddressName },
    },
    network: { toriiClient },
  } = useDojo();

  const getPlayers = useGetOtherPlayers();
  const players = useMemo(() => getPlayers(), [getPlayers]);

  const inputRef = useRef<string>("");

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter" || inputRef.current.length === 0) return;

      const contentParser = new ContentParser();
      if (contentParser.isWhisper(inputRef.current)) {
        const whisperDestination = contentParser.getWhisperDest(inputRef.current);
        const player = players.find((player) => player.addressName === whisperDestination);
        if (player) {
          const newTab = {
            name: player.addressName!,
            address: toHexString(player.address),
            displayed: true,
          };
          // TODO: Implement addNewTab functionality
          // addNewTab(newTab);
        }
      } else {
        publish(inputRef.current);
      }
      inputRef.current = "";
    },
    [players],
  );

  const publish = useCallback(
    async (message: string) => {
      const recipientEntities = Array.from(
        runQuery([Has(AddressName), HasValue(AddressName, { name: BigInt("0x0") })]),
      );

      const recipientAddress = recipientEntities.length
        ? getComponentValue(AddressName, recipientEntities[0])?.address
        : currentTab.name === GLOBAL_CHANNEL_KEY
          ? undefined
          : BigInt(currentTab.address);

      const channel = recipientAddress !== undefined ? toHexString(recipientAddress) : GLOBAL_CHANNEL;

      const messageInValidAscii = toValidAscii(message);
      const data = generateMessageTypedData(account.address, channel, messageInValidAscii, toHexString(salt));

      const signature: Signature = await account.signMessage(data);

      await toriiClient.publishMessage(JSON.stringify(data), signature as string[], true);
    },
    [account, salt, toriiClient, currentTab],
  );

  return (
    <TextInput
      key="chat-input"
      className="border border-gold/40 !w-auto text-gold"
      placeholder="Message"
      onChange={(value) => {
        inputRef.current = value;
      }}
      onKeyDown={handleKeyPress}
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
      chainId: "SN_SEPOLIA",
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
