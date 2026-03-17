import { Account, RpcProvider } from "starknet";
import { resolveDefaultRpcUrl } from "../constants";
import { resolveStarknetChainId } from "../shared/chains";
import { resolveAccountCredentials } from "../shared/credentials";

export interface GrantRoleCall {
  contractAddress: string;
  entrypoint: "grant_role";
  calldata: [string, string];
}

export interface GrantRoleRequest {
  chain: string;
  contractAddress: string;
  role: string;
  recipient: string;
  rpcUrl?: string;
  accountAddress?: string;
  privateKey?: string;
  context?: string;
  dryRun?: boolean;
}

export interface GrantRoleResult {
  chain: string;
  rpcUrl: string;
  contractAddress: string;
  role: string;
  recipient: string;
  transactionHash?: string;
  dryRun: boolean;
  call: GrantRoleCall;
}

interface GrantRoleExecution {
  rpcUrl: string;
  call: GrantRoleCall;
}

interface GrantRoleExecutionCredentials {
  accountAddress: string;
  privateKey: string;
}

export function buildGrantRoleCall(contractAddress: string, role: string, recipient: string): GrantRoleCall {
  return {
    contractAddress,
    entrypoint: "grant_role",
    calldata: [role, recipient],
  };
}

function resolveGrantRoleRpcUrl(chain: string, rpcUrl?: string): string {
  if (rpcUrl) {
    return rpcUrl;
  }

  return resolveDefaultRpcUrl(chain);
}

function resolveGrantRoleExecution(request: GrantRoleRequest): GrantRoleExecution {
  return {
    rpcUrl: resolveGrantRoleRpcUrl(request.chain, request.rpcUrl),
    call: buildGrantRoleCall(request.contractAddress, request.role, request.recipient),
  };
}

function createGrantRoleProvider(chain: string, rpcUrl: string): RpcProvider {
  const chainId = resolveStarknetChainId(chain);

  return chainId ? new RpcProvider({ nodeUrl: rpcUrl, chainId }) : new RpcProvider({ nodeUrl: rpcUrl });
}

function createGrantRoleAccount(chain: string, rpcUrl: string, credentials: GrantRoleExecutionCredentials): Account {
  return new Account({
    provider: createGrantRoleProvider(chain, rpcUrl),
    address: credentials.accountAddress,
    signer: credentials.privateKey,
  });
}

function resolveGrantRoleCredentials(request: GrantRoleRequest): GrantRoleExecutionCredentials {
  return resolveAccountCredentials({
    accountAddress: request.accountAddress,
    privateKey: request.privateKey,
    context: request.context || `chain "${request.chain}"`,
  });
}

function wasGrantRoleSuccessful(receipt: unknown): boolean {
  return (
    (typeof (receipt as { isSuccess?: () => boolean }).isSuccess === "function" &&
      (receipt as { isSuccess: () => boolean }).isSuccess()) ||
    (receipt as { execution_status?: string }).execution_status === "SUCCEEDED"
  );
}

async function submitGrantRoleTransaction(params: {
  chain: string;
  rpcUrl: string;
  credentials: GrantRoleExecutionCredentials;
  call: GrantRoleCall;
}): Promise<string> {
  const account = createGrantRoleAccount(params.chain, params.rpcUrl, params.credentials);
  const tx = await account.execute([params.call]);
  const receipt = await account.waitForTransaction(tx.transaction_hash);

  if (!wasGrantRoleSuccessful(receipt)) {
    throw new Error(`grant_role failed for tx ${tx.transaction_hash}`);
  }

  return tx.transaction_hash;
}

async function executeGrantRoleIfNeeded(
  request: GrantRoleRequest,
  execution: GrantRoleExecution,
): Promise<string | undefined> {
  if (request.dryRun) {
    return undefined;
  }

  return submitGrantRoleTransaction({
    chain: request.chain,
    rpcUrl: execution.rpcUrl,
    credentials: resolveGrantRoleCredentials(request),
    call: execution.call,
  });
}

function buildGrantRoleResult(
  request: GrantRoleRequest,
  execution: GrantRoleExecution,
  transactionHash?: string,
): GrantRoleResult {
  return {
    chain: request.chain,
    rpcUrl: execution.rpcUrl,
    contractAddress: request.contractAddress,
    role: request.role,
    recipient: request.recipient,
    transactionHash,
    dryRun: request.dryRun === true,
    call: execution.call,
  };
}

export async function grantRole(request: GrantRoleRequest): Promise<GrantRoleResult> {
  const execution = resolveGrantRoleExecution(request);
  const transactionHash = await executeGrantRoleIfNeeded(request, execution);
  return buildGrantRoleResult(request, execution, transactionHash);
}
