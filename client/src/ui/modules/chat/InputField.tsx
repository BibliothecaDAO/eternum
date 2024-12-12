import { useDojo } from "@/hooks/context/DojoContext";
import TextInput from "@/ui/elements/TextInput";
import { toHexString, toValidAscii } from "@/ui/utils/utils";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useCallback, useRef } from "react";
import { Signature } from "starknet";
import { env } from "../../../../env";
import { scrollToElement } from "./Chat";
import { GLOBAL_CHANNEL, GLOBAL_CHANNEL_KEY } from "./constants";
import { Tab } from "./types";

export const InputField = ({
  currentTab,
  salt,
  bottomChatRef,
}: {
  currentTab: Tab;
  salt: bigint;
  bottomChatRef: React.RefObject<HTMLDivElement>;
}) => {
  const {
    account: { account },
    setup: {
      components: { AddressName },
    },
    network: { toriiClient },
  } = useDojo();

  const inputRef = useRef<string>("");

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter" || inputRef.current.length === 0) return;
      publish(inputRef.current, salt, currentTab);
      inputRef.current = "";
      scrollToElement(bottomChatRef);
    },
    [salt, bottomChatRef, currentTab],
  );

  const publish = useCallback(
    async (message: string, salt: bigint, tab: Tab) => {
      const recipientEntities = Array.from(
        runQuery([Has(AddressName), HasValue(AddressName, { name: BigInt("0x0") })]),
      );

      const recipientAddress = recipientEntities.length
        ? getComponentValue(AddressName, recipientEntities[0])?.address
        : tab.name === GLOBAL_CHANNEL_KEY
          ? undefined
          : BigInt(tab.address);

      const channel = recipientAddress !== undefined ? toHexString(recipientAddress) : GLOBAL_CHANNEL;

      const messageInValidAscii = toValidAscii(message);

      const data = generateMessageTypedData(account.address, channel, messageInValidAscii, toHexString(salt));

      const signature: Signature = await account.signMessage(data);

      await toriiClient.publishMessage(JSON.stringify(data), signature as string[]);
    },
    [inputRef],
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
      "s0_eternum-Message": [
        { name: "identity", type: "ContractAddress" },
        { name: "channel", type: "shortstring" },
        { name: "content", type: "string" },
        { name: "timestamp", type: "felt" },
        { name: "salt", type: "felt" },
      ],
    },
    primaryType: "s0_eternum-Message",
    domain: {
      name: "Eternum",
      version: "1",
      chainId: env.VITE_PUBLIC_CHAIN == "mainnet" ? "SN_MAIN" : "SN_SEPOLIA",
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
