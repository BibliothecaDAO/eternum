import * as path from "node:path";
import { DEFAULT_CARTRIDGE_API_BASE } from "../constants";
import {
  isZeroAddress,
  patchManifestWithFactory,
  resolveFactoryWorldProfile,
  resolveRealmInternalSystemsAddress,
} from "../factory/discovery";
import { grantRole, type GrantRoleCall } from "../role-grants/grant-role";
import { resolveEternumNetwork } from "../shared/chains";
import type { GameManifestLike } from "../shared/manifest-types";
import { resolveCommonAddressesPath } from "../shared/addresses";
import { ensureRepoDirectory, loadRepoJsonFile, writeRepoJsonFile, writeRepoTextFile } from "../shared/repo";
import { toSafeSlug } from "../shared/slug";
import { MINTER_ROLE } from "./roles";

export interface GrantVillagePassMinterRoleRequest {
  chain: string;
  gameName: string;
  rpcUrl?: string;
  accountAddress?: string;
  privateKey?: string;
  cartridgeApiBase?: string;
  dryRun?: boolean;
}

export interface GrantVillagePassMinterRoleSummary {
  chain: string;
  network: string;
  gameName: string;
  rpcUrl: string;
  worldAddress: string;
  villagePassAddress: string;
  realmInternalSystemsAddress: string;
  transactionHash?: string;
  dryRun: boolean;
  outputPath: string;
}

interface VillagePassGrantTarget {
  network: string;
  worldAddress: string;
  patchedManifest: GameManifestLike;
  villagePassAddress: string;
  realmInternalSystemsAddress: string;
}

function buildCallPayload(call: GrantRoleCall): string {
  return `${call.contractAddress} ${call.entrypoint} ${call.calldata.join(" ")}`;
}

function loadBaseGameManifest(network: string): GameManifestLike {
  return loadRepoJsonFile<GameManifestLike>(`contracts/game/manifest_${network}.json`);
}

function requireFactoryWorldProfile(
  chain: string,
  gameName: string,
  profile: Awaited<ReturnType<typeof resolveFactoryWorldProfile>>,
) {
  if (!profile?.worldAddress) {
    throw new Error(`Could not resolve factory deployment for "${gameName}" on "${chain}"`);
  }

  return profile;
}

function resolveVillagePassAddress(network: string): string {
  const commonAddressesPath = resolveCommonAddressesPath(network);
  const commonAddresses = loadRepoJsonFile<Record<string, unknown>>(commonAddressesPath);
  const villagePassAddress = commonAddresses.villagePass;

  if (typeof villagePassAddress !== "string" || isZeroAddress(villagePassAddress)) {
    throw new Error(`Could not resolve non-zero "villagePass" address from ${commonAddressesPath}`);
  }

  return villagePassAddress;
}

async function resolveVillagePassGrantTarget(
  request: GrantVillagePassMinterRoleRequest,
): Promise<VillagePassGrantTarget> {
  const network = resolveEternumNetwork(request.chain);
  const cartridgeApiBase = request.cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE;
  const baseManifest = loadBaseGameManifest(network);
  const profile = requireFactoryWorldProfile(
    request.chain,
    request.gameName,
    await resolveFactoryWorldProfile(network, request.gameName, cartridgeApiBase),
  );
  const patchedManifest = patchManifestWithFactory(baseManifest, profile.worldAddress, profile.contractsBySelector);

  return {
    network,
    worldAddress: profile.worldAddress,
    patchedManifest,
    villagePassAddress: resolveVillagePassAddress(network),
    realmInternalSystemsAddress: resolveRealmInternalSystemsAddress(patchedManifest),
  };
}

function writeVillagePassRoleArtifacts(params: {
  chain: string;
  gameName: string;
  patchedManifest: GameManifestLike;
  call: GrantRoleCall;
  summary: Omit<GrantVillagePassMinterRoleSummary, "outputPath">;
}): string {
  ensureRepoDirectory(path.join(".context/village-pass-minter-role", params.chain));
  const baseFilename = toSafeSlug(params.gameName);

  const outputPath = writeRepoJsonFile(
    path.join(".context/village-pass-minter-role", params.chain, `${baseFilename}.json`),
    params.summary,
  );
  writeRepoJsonFile(
    path.join(".context/village-pass-minter-role", params.chain, `${baseFilename}.patched-manifest.json`),
    params.patchedManifest,
  );
  writeRepoJsonFile(
    path.join(".context/village-pass-minter-role", params.chain, `${baseFilename}.grant-role-call.json`),
    params.call,
  );
  writeRepoTextFile(
    path.join(".context/village-pass-minter-role", params.chain, `${baseFilename}.grant-role-call.txt`),
    buildCallPayload(params.call),
  );

  return outputPath;
}

function buildVillagePassRoleSummary(params: {
  request: GrantVillagePassMinterRoleRequest;
  target: VillagePassGrantTarget;
  rpcUrl: string;
  transactionHash?: string;
}): Omit<GrantVillagePassMinterRoleSummary, "outputPath"> {
  return {
    chain: params.request.chain,
    network: params.target.network,
    gameName: params.request.gameName,
    rpcUrl: params.rpcUrl,
    worldAddress: params.target.worldAddress,
    villagePassAddress: params.target.villagePassAddress,
    realmInternalSystemsAddress: params.target.realmInternalSystemsAddress,
    transactionHash: params.transactionHash,
    dryRun: params.request.dryRun === true,
  };
}

export async function grantVillagePassRoleToRealmInternalSystems(
  request: GrantVillagePassMinterRoleRequest,
): Promise<GrantVillagePassMinterRoleSummary> {
  const target = await resolveVillagePassGrantTarget(request);
  const roleGrant = await grantRole({
    chain: target.network,
    contractAddress: target.villagePassAddress,
    role: MINTER_ROLE,
    recipient: target.realmInternalSystemsAddress,
    rpcUrl: request.rpcUrl,
    accountAddress: request.accountAddress,
    privateKey: request.privateKey,
    context: `chain "${request.chain}"`,
    dryRun: request.dryRun,
  });

  const summaryWithoutOutput = buildVillagePassRoleSummary({
    request,
    target,
    rpcUrl: roleGrant.rpcUrl,
    transactionHash: roleGrant.transactionHash,
  });
  const outputPath = writeVillagePassRoleArtifacts({
    chain: request.chain,
    gameName: request.gameName,
    patchedManifest: target.patchedManifest,
    call: roleGrant.call,
    summary: summaryWithoutOutput,
  });

  return {
    ...summaryWithoutOutput,
    outputPath,
  };
}

export const grantVillagePassMinterRole = grantVillagePassRoleToRealmInternalSystems;
