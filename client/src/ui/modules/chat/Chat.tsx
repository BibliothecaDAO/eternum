import { useDojo } from "@/hooks/context/DojoContext";
import { useCallback, useEffect, useState } from "react";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { shortString, TypedData } from "starknet";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { getEntityIdFromKeys } from "@dojoengine/utils";

const GLOBAL_CHANNEL = shortString.encodeShortString("global");

export function generateMessageTypedData(identity: string, channel: string, content: string, salt: string) {
  return {
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      OffchainMessage: [
        { name: "model", type: "shortstring" },
        { name: "eternum-Message", type: "Model" },
      ],
      Model: [
        { name: "identity", type: "ContractAddress" },
        { name: "channel", type: "shortstring" },
        { name: "content", type: "string" },
        { name: "salt", type: "felt" },
      ],
    },
    primaryType: "OffchainMessage",
    domain: {
      name: "Eternum",
      version: "1",
      chainId: "1",
      revision: "1",
    },
    message: {
      model: "eternum-Message",
      "eternum-Message": {
        identity,
        channel,
        content,
        salt,
      },
    },
  };
}

export const Chat = () => {
  const {
    account: { account },
    setup: {
      components: { Message, AddressName },
    },
    network: { toriiClient },
  } = useDojo();

  const [messages, setMessages] = useState<{ name: string; content: string }[]>([]);
  const [content, setContent] = useState<string>("");
  const [channel, setChannel] = useState<string>("");
  const [salt, setSalt] = useState<bigint>(0n);

  const allMessageEntities = useEntityQuery([Has(Message), HasValue(Message, { channel: BigInt(GLOBAL_CHANNEL) })]);
  const selfMessageEntities = useEntityQuery([Has(Message), HasValue(Message, { identity: BigInt(account.address) })]);
  const receivedMessageEntities = useEntityQuery([
    Has(Message),
    HasValue(Message, { channel: BigInt(account.address) }),
  ]);
  const recipientEntities = useEntityQuery([
    Has(AddressName),
    HasValue(AddressName, { name: BigInt(!channel ? "0x0" : shortString.encodeShortString(channel)) }),
  ]);

  useEffect(() => {
    const messages = [...allMessageEntities, ...receivedMessageEntities].map((entity) => {
      const message = getComponentValue(Message, entity);
      const address = `0x${message?.identity.toString(16)}`;
      const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));
      const name = shortString.decodeShortString(addressName?.name.toString() || "") || "Unkown";
      const content = !!message?.content ? message.content : "";
      return { name, content };
    });
    setMessages(messages);
  }, [allMessageEntities, receivedMessageEntities]);

  useEffect(() => {
    const salts = selfMessageEntities.map((entity) => {
      const message = getComponentValue(Message, entity);
      return message?.salt || 0n;
    });
    if (!salts.length) return;
    setSalt(salts.sort((a, b) => Number(b) - Number(a))[0] + 1n);
  }, [selfMessageEntities, salt]);

  const publish = useCallback(
    async (message: string) => {
      const recipientAddress = !!recipientEntities.length
        ? getComponentValue(AddressName, recipientEntities[0])?.address
        : "";
      const channel = !!recipientAddress ? `0x${recipientAddress.toString(16)}` : GLOBAL_CHANNEL;
      const data = generateMessageTypedData(account.address, channel, message, `0x${salt?.toString(16)}`);
      const signature: any = await account.signMessage(data as TypedData);
      toriiClient.publishMessage(JSON.stringify(data), [
        `0x${signature.r.toString(16)}`,
        `0x${signature.s.toString(16)}`,
      ]);
    },
    [account, recipientEntities, salt, toriiClient],
  );

  return (
    <div className="flex flex-col gap-2 w-60" style={{ zIndex: 100 }}>
      {messages.map((message, index) => (
        <div className="flex gap-2 ml-4" key={index}>
          <span>{`${message.name}: `}</span>
          <p>{message.content}</p>
        </div>
      ))}
      <TextInput
        className="border border-gold mx-1 !w-auto !text-light-pink"
        placeholder="Global"
        value={channel}
        onChange={setChannel}
      />
      <TextInput
        className="border border-gold mx-1 !w-auto !text-light-pink"
        placeholder="Message"
        value={content}
        onChange={setContent}
      />
      <Button onClick={() => publish(content)}>Publish</Button>
    </div>
  );
};
