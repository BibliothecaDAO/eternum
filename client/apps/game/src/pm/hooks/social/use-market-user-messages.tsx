import { ClauseBuilder, ToriiQueryBuilder, type SchemaType, type StandardizedQueryResult } from "@dojoengine/sdk";
import { useEffect, useMemo, useState } from "react";
import { AccountInterface, addAddressPadding, BigNumberish, cairo } from "starknet";
import { UserMessage } from "../../bindings";
import { useDojoSdk } from "../dojo/use-dojo-sdk";

// todo: make it work
export const useMarketUserMessages = (marketId: BigNumberish) => {
  const {
    sdk,
    config: { manifest },
  } = useDojoSdk();

  const worldAddress = manifest.world.address;
  const [messages, setMessages] = useState<UserMessage[]>([]);

  const query = useMemo(() => {
    return new ToriiQueryBuilder()
      .addEntityModel("pm-UserMessage")
      .withClause(
        new ClauseBuilder()
          .where("pm-UserMessage", "market_id", "Eq", addAddressPadding(`0x${BigInt(marketId).toString(16)}`))
          .build(),
      )
      .withLimit(1_000)
      .addOrderBy("timestamp", "Desc")
      .includeHashedKeys();
  }, [marketId]);

  const refresh = async () => {
    const res = await sdk.getEntities({ query });
    const items: StandardizedQueryResult<SchemaType> = res.getItems();
    const parsedItems = items.flatMap((i) => {
      if (!i.models.pm.UserMessage) return [];
      return [i.models.pm.UserMessage as unknown as UserMessage];
    });

    setMessages(parsedItems);
  };

  useEffect(() => {
    refresh();
  }, [query]);

  const sendMessage = async (account: AccountInterface, message: string) => {
    if (!account) return;

    const market_id = cairo.uint256(marketId);
    const msg = sdk.generateTypedData("pm-UserMessage", {
      identity: account.address,
      timestamp: Date.now(),
      market_id,
      message,
    });

    // temp fix
    msg.types["pm-UserMessage"][2].type = "u256";

    try {
      const signature = await account.signMessage(msg);

      try {
        await sdk.client.publishMessage({
          world_address: worldAddress,
          message: JSON.stringify(msg),
          // @ts-ignore
          signature: [...signature] as string[],
          // signature: [signature.r.toString() , signature.s.toString()] as string[],
        });
        setTimeout(() => {
          refresh();
        }, 1_000);
      } catch (error) {
        console.error("failed to publish message:", error);
      }
    } catch (error) {
      console.error("failed to sign message:", error);
    }
  };

  return {
    messages,
    sendMessage,
    refresh,
  };
};
