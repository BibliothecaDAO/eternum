import { useDojo } from "@/hooks/context/DojoContext";
import { useCallback, useEffect, useState } from "react";
// import * as torii from "@dojoengine/torii-client";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { shortString, TypedData } from "starknet";

export function generateMessageTypedData(
  identity: string,
  channel: string,
  content: string,
  salt: string,
) {
  return {
    types: {
      StarknetDomain: [
        { name: 'name', type: 'shortstring' },
        { name: 'version', type: 'shortstring' },
        { name: 'chainId', type: 'shortstring' },
        { name: 'revision', type: 'shortstring' },
      ],
      OffchainMessage: [
        { name: 'model', type: 'shortstring' },
        { name: 'eternum-Message', type: 'Model' },
      ],
      Model: [
        { name: 'identity', type: 'ContractAddress' },
        { name: 'channel', type: 'shortstring' },
        { name: 'content', type: 'string' },
        { name: 'salt', type: 'felt' },
      ],
    },
    primaryType: 'OffchainMessage',
    domain: {
      name: 'Eternum',
      version: '1',
      chainId: '1',
      revision: '1',
    },
    message: {
      model: 'eternum-Message',
      'eternum-Message': {
        identity,
        channel,
        content,
        salt,
      },
    },
  }
}

export const Chat = () => {
  const {
    account: {
      account,
    },
    setup: {
      components: {
        Message,
      },
    },
    network: {
      toriiClient,
    }
  } = useDojo();

  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState<string>("");
  const [channel, setChannel] = useState<string>(shortString.encodeShortString("global"));
  const [salt, setSalt] = useState<bigint>(0n);

  const allEntities = useEntityQuery([Has(Message)]);
  const selfEntities = useEntityQuery([Has(Message), HasValue(Message, { identity: BigInt(account.address) })]);

  useEffect(() => {
    const messages = allEntities.map((entity) => {
      const message = getComponentValue(Message, entity);
      return message?.content || "";
    });
    setMessages(messages);
  }, [allEntities]);

  useEffect(() => {
    const salts = selfEntities.map((entity) => {
      const message = getComponentValue(Message, entity);
      return message?.salt || 0n;
    });
    if (!salts.length) return;
    setSalt(salts.sort((a, b) => Number(b) - Number(a))[0] + 1n);
  }, [selfEntities, salt]);

  const publish = useCallback(async (message: string) => {
    const data = generateMessageTypedData(account.address, channel, message, `0x${salt?.toString(16)}`);
    // const hash = torii.typedDataEncode(JSON.stringify(data), account.address);
    const signature: any = await account.signMessage(data as TypedData);
    toriiClient.publishMessage(JSON.stringify(data), [`0x${signature.r.toString(16)}`, `0x${signature.s.toString(16)}`]);
  }, [account, channel, salt, toriiClient]);

  return (
    <div style={{ zIndex: 100 }}>
      {messages.map((message, index) => (
        <div key={index}>
          {message}
        </div>
      ))}
      <input value={content} onChange={(e) => setContent(e.target.value)} />
      <div onClick={() => publish(content)}>
        Publish
      </div>
    </div>
  );
};
