import { env } from "@/../env";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

export interface CosmeticMetadataAttribute {
  trait_type: string;
  value: string;
}

export interface CosmeticMetadata {
  attributes?: CosmeticMetadataAttribute[];
  description?: string;
  image?: string;
  name?: string;
}

export interface ToriiCosmeticRow {
  account_address: string;
  token_name: string;
  token_symbol: string;
  token_id?: string | number;
  balance: string | number;
  decimals: number;
  metadata: string | null;
}

export interface ToriiCosmeticAsset {
  accountAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenId: string | null;
  balance: string;
  decimals: number;
  metadata: CosmeticMetadata | null;
}

const DEFAULT_ACCOUNT_ADDRESS = "0x244a1fc5c84068c53c2683f9702fbcc192c0515b74f2ad0fc2070b5fd9f13fe";
const COSMETICS_SQL_ENDPOINT = `${env.VITE_PUBLIC_TORII}/sql`;

const buildSqlQuery = (accountAddress: string) => `SELECT
  b.account_address,
  h.name AS token_name,
  h.symbol AS token_symbol,
  h.token_id,
  CAST(b.balance AS DECIMAL(38, 0)) AS balance,
  h.decimals,
  h.metadata
FROM
  token_balances b
JOIN
  tokens h
ON
  b.contract_address = h.contract_address
  AND b.token_id = CONCAT('0x1239517c8c0905b95cf5ef83ec88ca03c1fd9ff7097f40a6bfca0f27962b565:', h.token_id)
WHERE
  b.account_address = '${accountAddress}'
  AND b.contract_address = '0x1239517c8c0905b95cf5ef83ec88ca03c1fd9ff7097f40a6bfca0f27962b565';`;

const parseMetadata = (rawMetadata: string | null): CosmeticMetadata | null => {
  if (!rawMetadata) return null;

  try {
    const parsed = JSON.parse(rawMetadata) as CosmeticMetadata;

    if (Array.isArray(parsed.attributes)) {
      parsed.attributes = parsed.attributes
        .filter((attribute): attribute is CosmeticMetadataAttribute => {
          return (
            Boolean(attribute) &&
            typeof attribute.trait_type === "string" &&
            attribute.trait_type.trim().length > 0 &&
            attribute.value !== undefined &&
            attribute.value !== null
          );
        })
        .map((attribute) => ({
          trait_type: attribute.trait_type,
          value: String(attribute.value),
        }));
    } else {
      parsed.attributes = [];
    }

    return parsed;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Failed to parse cosmetic metadata", error);
    }
    return null;
  }
};

const fetchCosmeticAssets = async (accountAddress: string): Promise<ToriiCosmeticAsset[]> => {
  const query = buildSqlQuery(accountAddress);
  const url = `${COSMETICS_SQL_ENDPOINT}?query=${encodeURIComponent(query)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to fetch cosmetics: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ToriiCosmeticRow[];

  return data.map((row) => ({
    accountAddress: row.account_address,
    tokenName: row.token_name,
    tokenSymbol: row.token_symbol,
    tokenId:
      row.token_id === undefined ? null : typeof row.token_id === "number" ? row.token_id.toString() : row.token_id,
    balance: typeof row.balance === "number" ? row.balance.toString() : row.balance,
    decimals: row.decimals,
    metadata: parseMetadata(row.metadata),
  }));
};

interface UseToriiCosmeticsOptions extends Pick<UseQueryOptions<ToriiCosmeticAsset[], Error>, "staleTime" | "enabled"> {
  accountAddress?: string;
}

export const useToriiCosmetics = ({
  accountAddress = DEFAULT_ACCOUNT_ADDRESS,
  enabled = true,
  staleTime = 60_000,
}: UseToriiCosmeticsOptions = {}) => {
  const queryAccount = accountAddress?.toLowerCase() ?? DEFAULT_ACCOUNT_ADDRESS;
  const isEnabled = enabled && Boolean(queryAccount);

  return useQuery({
    queryKey: ["torii", "cosmetics", queryAccount],
    queryFn: () => fetchCosmeticAssets(queryAccount),
    enabled: isEnabled,
    staleTime,
  });
};
