import { readFileSync } from "node:fs";
import { hash, json, type Account, type RpcProvider, type CompiledSierra, type CompiledSierraCasm } from "starknet";
import type { ClassArtifact } from "../world/types";

export function readClassArtifact(sierraPath: string, casmPath: string): ClassArtifact {
  const sierra = json.parse(readFileSync(sierraPath, "utf8")) as CompiledSierra;
  const casm = json.parse(readFileSync(casmPath, "utf8")) as CompiledSierraCasm;
  return {
    sierra,
    casm,
    classHash: hash.computeContractClassHash(sierra),
    // Madara 0.14.2 requires V2 CASM hashing, independently of the RPC hostname.
    compiledClassHash: hash.computeCompiledClassHashBlake(casm),
  };
}

export function rpcErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error as { code?: unknown; baseError?: unknown; error?: unknown };
  return typeof value.code === "number" ? value.code : rpcErrorCode(value.baseError ?? value.error);
}

export async function isClassDeclared(provider: RpcProvider, classHash: string, block: number | "latest" = "latest") {
  try {
    await provider.getClass(classHash, block);
    return true;
  } catch (error) {
    if (rpcErrorCode(error) === 28) return false;
    throw error;
  }
}

export async function declareClass(account: Account, artifact: ClassArtifact): Promise<string | undefined> {
  if (await isClassDeclared(account, artifact.classHash)) return undefined;
  const result = await account.declare(
    {
      contract: artifact.sierra,
      classHash: artifact.classHash,
      compiledClassHash: artifact.compiledClassHash,
    },
    { tip: 0 },
  );
  await waitForSuccess(account, result.transaction_hash);
  return result.transaction_hash;
}

export async function waitForSuccess(provider: RpcProvider, transactionHash: string): Promise<void> {
  const receipt = await provider.waitForTransaction(transactionHash, { retryInterval: 500, retries: 600 });
  if (!receipt.isSuccess()) throw new Error(`Transaction ${transactionHash} failed: ${JSON.stringify(receipt)}`);
}
