const ASSETS = [
  {
    addressKey: "mmrToken",
    artifactName: "MMRToken",
    id: "mmr",
    label: "MMR token",
    packageDirectory: "mmr",
    projectName: "mmr",
    upgradeAuthority: { address: "MMR_UPGRADER_ADDRESS", privateKey: "MMR_UPGRADER_PRIVATE_KEY" },
    upgradeAuthorityKind: "role",
    upgradeRoleName: "UPGRADER_ROLE",
  },
  {
    addressKey: "seasonPass",
    artifactName: "EternumSeasonPass",
    id: "season-pass",
    label: "Season Pass",
    packageDirectory: "season_pass",
    projectName: "esp",
    upgradeAuthority: { address: "SEASON_PASS_OWNER_ADDRESS", privateKey: "SEASON_PASS_OWNER_PRIVATE_KEY" },
    upgradeAuthorityKind: "owner",
  },
  {
    addressKey: "villagePass",
    artifactName: "EternumVillagePass",
    id: "village-pass",
    label: "Village Pass",
    packageDirectory: "village_pass",
    projectName: "evp",
    upgradeAuthority: { address: "VILLAGE_PASS_UPGRADER_ADDRESS", privateKey: "VILLAGE_PASS_UPGRADER_PRIVATE_KEY" },
    upgradeAuthorityKind: "role",
    upgradeRoleName: "UPGRADER_ROLE",
  },
];

const ROLE_GRANTS = [
  {
    adminAuthority: { address: "MMR_ADMIN_ADDRESS", privateKey: "MMR_ADMIN_PRIVATE_KEY" },
    assetId: "mmr",
    roleName: "UPDATER_ROLE",
  },
  {
    adminAuthority: { address: "VILLAGE_PASS_ADMIN_ADDRESS", privateKey: "VILLAGE_PASS_ADMIN_PRIVATE_KEY" },
    assetId: "village-pass",
    roleName: "DISTRIBUTOR_ROLE",
  },
];

export function buildLiveAssetPlan(addresses, environment, requirePrivateKeys) {
  const ledgerAddress = requireAddress(addresses.ledger, "contracts/common/addresses/mainnet.json:ledger");
  const assets = ASSETS.map((asset) => ({
    ...asset,
    address: requireAddress(addresses[asset.addressKey], `contracts/common/addresses/mainnet.json:${asset.addressKey}`),
    upgradeSigner: readSigner(environment, asset.upgradeAuthority, requirePrivateKeys),
  }));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const roleGrants = ROLE_GRANTS.map((grant) => ({
    ...grant,
    adminSigner: readSigner(environment, grant.adminAuthority, requirePrivateKeys),
    contractAddress: requireAsset(assetById, grant.assetId).address,
    grantee: ledgerAddress,
  }));

  return {
    assets,
    declarationSigner: readSigner(
      environment,
      { address: "STARKNET_ACCOUNT_ADDRESS", privateKey: "STARKNET_ACCOUNT_PRIVATE_KEY" },
      requirePrivateKeys,
    ),
    ledgerAddress,
    roleGrants,
  };
}

function requireAsset(assetById, assetId) {
  const asset = assetById.get(assetId);
  if (!asset) throw new Error(`Unknown live asset ${assetId}`);
  return asset;
}

function readSigner(environment, names, requirePrivateKey) {
  const signer = { address: requireAddress(environment[names.address], names.address) };
  if (requirePrivateKey) signer.privateKey = requireValue(environment[names.privateKey], names.privateKey);
  return signer;
}

function requireAddress(value, label) {
  const normalized = `0x${BigInt(requireValue(value, label)).toString(16)}`;
  if (BigInt(normalized) === 0n) throw new Error(`${label} must be non-zero`);
  return normalized;
}

function requireValue(value, label) {
  if (value === undefined || value === null || `${value}`.trim() === "") throw new Error(`${label} is required`);
  return `${value}`.trim();
}
