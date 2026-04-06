import { ClauseBuilder, ToriiQueryBuilder, type SchemaType, type StandardizedQueryResult } from "@dojoengine/sdk";
import { useEffect, useMemo, useState } from "react";
import { uint256 } from "starknet";
import { ProtocolFees } from "../../bindings";
import { deepEqual } from "../../utils";
import { useDojoSdk } from "../dojo/use-dojo-sdk";

const coerceBigIntValue = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return Number.isFinite(value) ? BigInt(Math.trunc(value)) : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof value === "boolean") return value ? 1n : 0n;
  return null;
};

export const useProtocolFees = (address: string | null, enabled = true) => {
  const { sdk } = useDojoSdk();
  const [protocolFees, setProtocolFees] = useState<ProtocolFees[]>([]);

  const normalizedAddress = useMemo(() => {
    const parsed = coerceBigIntValue(address);
    return parsed != null && parsed > 0n ? parsed.toString() : null;
  }, [address]);

  const address_u256 = useMemo(() => uint256.bnToUint256(normalizedAddress ?? "0"), [normalizedAddress]);

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
      if (!enabled || !normalizedAddress) {
        if (!cancelled) {
          setProtocolFees([]);
        }
        return;
      }

      try {
        const entitiesResponse = await sdk.getEntities({ query: protocolFeesQuery });
        const entities: StandardizedQueryResult<SchemaType> = entitiesResponse.getItems();

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
  }, [enabled, normalizedAddress, protocolFeesQuery, sdk]);

  return {
    fees: protocolFees,
  };
};
