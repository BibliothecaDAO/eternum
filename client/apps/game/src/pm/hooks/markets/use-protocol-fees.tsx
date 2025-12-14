import { ClauseBuilder, ToriiQueryBuilder } from "@dojoengine/sdk";
import { useEffect, useMemo, useState } from "react";
import { uint256 } from "starknet";
import { ProtocolFees } from "../../bindings";
import { deepEqual } from "../../utils";
import { useDojoSdk } from "../dojo/use-dojo-sdk";

export const useProtocolFees = (address: string) => {
  const { sdk } = useDojoSdk();
  const [protocolFees, setProtocolFees] = useState<ProtocolFees[]>([]);

  const address_u256 = useMemo(() => uint256.bnToUint256(address), [address]);

  const protocolFeesQuery = useMemo(() => {
    return new ToriiQueryBuilder()
      .withEntityModels(["pm-ProtocolFees"])
      .withClause(
        new ClauseBuilder()
          .keys(
            ["pm-ProtocolFees"],
            [address_u256.low.toString(), address_u256.high.toString()],
            // [shortString.encodeShortString("PROTOCOL")],
            "VariableLen",
          )
          .build(),
      )
      .includeHashedKeys();
  }, [address_u256.high, address_u256.low]);

  useEffect(() => {
    let cancelled = false;

    const fetchProtocolFees = async () => {
      try {
        const entities = (await sdk.getEntities({ query: protocolFeesQuery })).getItems();

        const newFees = entities.flatMap((entity) => {
          const item = entity.models.pm.ProtocolFees as ProtocolFees;
          return item ? [item] : [];
        });

        if (!cancelled) {
          setProtocolFees((prev) => (deepEqual(prev, newFees) ? prev : newFees));
        }
      } catch (error) {
        console.error("[pm-sdk] Failed to fetch protocol fees", error);
      }
    };

    void fetchProtocolFees();

    return () => {
      cancelled = true;
    };
  }, [sdk, protocolFeesQuery]);

  return {
    fees: protocolFees,
  };
};
