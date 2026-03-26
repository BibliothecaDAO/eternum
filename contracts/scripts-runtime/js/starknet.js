import "dotenv/config";
import { Account, RpcProvider } from "starknet";
import { readContractArtifacts } from "./artifacts.js";
import { printRuntimeAction, printRuntimeSuccess, printRuntimeValue } from "./output.js";

const NETWORKS = {
  local: {
    explorerUrl: "http://localhost:3001",
    rpcUrl: process.env.STARKNET_RPC,
  },
  mainnet: {
    explorerUrl: "https://voyager.online",
    rpcUrl: process.env.STARKNET_RPC,
  },
  sepolia: {
    explorerUrl: "https://sepolia.voyager.online",
    rpcUrl: process.env.STARKNET_RPC,
  },
  slot: {
    explorerUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/explorer",
    rpcUrl: process.env.STARKNET_RPC,
  },
  slottest: {
    explorerUrl: "https://slot.voyager.online",
    rpcUrl: process.env.STARKNET_RPC,
  },
};

const UDC_ADDRESS = "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf";
const UDC_ENTRYPOINT = "deployContract";
const UINT128_MAX = (1n << 128n) - 1n;

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }

  return value;
}

function resolveAccountAddress(accountAddress) {
  const resolvedAddress = accountAddress ?? requireEnv("STARKNET_ACCOUNT_ADDRESS");

  if (typeof resolvedAddress === "bigint") {
    return `0x${resolvedAddress.toString(16)}`;
  }

  return `${resolvedAddress}`;
}

export function getSelectedNetworkName() {
  const configuredNetworkName = process.env.STARKNET_NETWORK;

  if (!configuredNetworkName) {
    throw new Error("Missing STARKNET_NETWORK");
  }

  const networkName = configuredNetworkName.toLowerCase();

  if (!NETWORKS[networkName]) {
    throw new Error(`Unsupported Starknet network ${networkName}`);
  }

  return networkName;
}

export function getNetworkConfig() {
  return NETWORKS[getSelectedNetworkName()];
}

export function getProvider() {
  return new RpcProvider({ nodeUrl: requireEnv("STARKNET_RPC") });
}

export function getAccount({ accountAddress } = {}) {
  return new Account({
    address: resolveAccountAddress(accountAddress),
    provider: getProvider(),
    signer: requireEnv("STARKNET_ACCOUNT_PRIVATE_KEY"),
  });
}

export function toUint256Calldata(value) {
  const bigintValue = BigInt(value);

  if (bigintValue < 0n) {
    throw new Error("Uint256 values must be non-negative");
  }

  return [bigintValue & UINT128_MAX, bigintValue >> 128n];
}

function explorerTransactionUrl(transactionHash) {
  return `${getNetworkConfig().explorerUrl}/tx/${transactionHash}`;
}

export async function declareContract({ accountAddress, artifactPaths, label }) {
  const account = getAccount({ accountAddress });
  const artifacts = readContractArtifacts(artifactPaths);

  printRuntimeAction(`Declaring ${label}...`);
  const declaration = await account.declareIfNot({
    casm: artifacts.casm,
    contract: artifacts.contract,
  });

  printRuntimeValue("Class hash:", declaration.class_hash);

  if (declaration.transaction_hash) {
    printRuntimeValue("Tx hash:", explorerTransactionUrl(declaration.transaction_hash));
    await account.waitForTransaction(declaration.transaction_hash);
  } else {
    printRuntimeSuccess("Tx hash: Already declared");
  }

  return declaration.class_hash;
}

export async function deployContract({ accountAddress, classHash, constructorCalldata, label }) {
  const account = getAccount({ accountAddress });
  account.deployer.address = UDC_ADDRESS;
  account.deployer.entryPoint = UDC_ENTRYPOINT;

  printRuntimeAction(`Deploying ${label}...`);
  const deployment = await account.deployContract({
    classHash,
    constructorCalldata,
  });

  printRuntimeValue("Tx hash:", explorerTransactionUrl(deployment.transaction_hash));
  await account.waitForTransaction(deployment.transaction_hash);
  printRuntimeValue("Contract address:", deployment.address);

  return deployment.address;
}

export async function executeContractCall({ accountAddress, calldata, contractAddress, entrypoint, label }) {
  return executeContractCalls({
    accountAddress,
    calls: [
      {
        calldata,
        contractAddress,
        entrypoint,
      },
    ],
    label,
  });
}

export async function executeContractCalls({ accountAddress, calls, label }) {
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new Error("executeContractCalls requires at least one call");
  }

  const account = getAccount({ accountAddress });

  printRuntimeAction(`Executing ${label}...`);
  const transaction = await account.execute(calls);

  printRuntimeValue("Tx hash:", explorerTransactionUrl(transaction.transaction_hash));
  await account.waitForTransaction(transaction.transaction_hash);

  return transaction.transaction_hash;
}

export async function upgradeContract({ accountAddress, contractAddress, label, newClassHash }) {
  return executeContractCall({
    accountAddress,
    calldata: [newClassHash],
    contractAddress,
    entrypoint: "upgrade",
    label: `${label} upgrade`,
  });
}

export async function upgradeContracts({ accountAddress, label, upgradeOperations }) {
  if (!Array.isArray(upgradeOperations) || upgradeOperations.length === 0) {
    throw new Error("upgradeContracts requires at least one upgrade operation");
  }

  return executeContractCalls({
    accountAddress,
    calls: upgradeOperations.map((upgradeOperation) => ({
      calldata: [upgradeOperation.newClassHash],
      contractAddress: upgradeOperation.contractAddress,
      entrypoint: "upgrade",
    })),
    label: `${label} upgrade multicall`,
  });
}
