import { resolveEndpoint } from "@realms-world/chain";

const requireServerEndpoint = (name: "TORII_SQL_URL" | "STARKNET_MAINNET_RPC_URL"): string =>
  resolveEndpoint(process.env[name], {
    name,
    browserFacing: false,
  });

export const resolveToriiSqlUrl = (): string => requireServerEndpoint("TORII_SQL_URL");

export const resolveMainnetRpcUrl = (): string => requireServerEndpoint("STARKNET_MAINNET_RPC_URL");

export const validateRequiredEndpoints = (): void => {
  resolveToriiSqlUrl();
  resolveMainnetRpcUrl();
};
