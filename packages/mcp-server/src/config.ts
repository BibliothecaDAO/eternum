import { z } from "zod";

export const ConfigSchema = z
  .object({
    toriiSqlUrl: z.string().url(),
    toriiGrpcUrl: z.string().url().optional(),
    starknetRpcUrl: z.string().url().optional(),
    dojoManifestPath: z.string().optional(),
    dojoManifestJson: z.string().optional(),
    accountAddress: z.string().optional(),
    accountPrivateKey: z.string().optional(),
    vrfProviderAddress: z.string().optional(),
  })
  .refine(
    (value) => {
      if (!value.accountAddress && !value.accountPrivateKey) {
        return true;
      }
      return Boolean(value.accountAddress) && Boolean(value.accountPrivateKey);
    },
    {
      message: "Both MCP_ACCOUNT_ADDRESS and MCP_ACCOUNT_PRIVATE_KEY must be provided together",
      path: ["accountPrivateKey"],
    },
  )
  .refine(
    (value) => {
      if (!value.accountAddress) return true;
      return Boolean(value.dojoManifestPath) || Boolean(value.dojoManifestJson);
    },
    {
      message: "When using on-chain tools you must provide MCP_DOJO_MANIFEST_PATH or MCP_DOJO_MANIFEST_JSON",
      path: ["dojoManifestPath"],
    },
  );

export type Config = z.infer<typeof ConfigSchema>;

function formatErrors(error: z.ZodError) {
  return error.errors.map((item) => `${item.path.join(".") || "root"}: ${item.message}`).join("; ");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse({
    toriiSqlUrl: env.MCP_TORII_SQL_URL,
    toriiGrpcUrl: env.MCP_TORII_GRPC_URL,
    starknetRpcUrl: env.MCP_STARKNET_RPC_URL,
    dojoManifestPath: env.MCP_DOJO_MANIFEST_PATH,
    dojoManifestJson: env.MCP_DOJO_MANIFEST_JSON,
    accountAddress: env.MCP_ACCOUNT_ADDRESS,
    accountPrivateKey: env.MCP_ACCOUNT_PRIVATE_KEY,
    vrfProviderAddress: env.MCP_VRF_PROVIDER_ADDRESS,
  });

  if (!parsed.success) {
    throw new Error(`Invalid MCP server configuration: ${formatErrors(parsed.error)}`);
  }

  return parsed.data;
}
