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

export interface GrantRolesRequest {
  chain: string;
  calls: GrantRoleCall[];
  rpcUrl?: string;
  accountAddress?: string;
  privateKey?: string;
  context?: string;
  dryRun?: boolean;
}

export interface GrantRolesResult {
  chain: string;
  rpcUrl: string;
  transactionHash?: string;
  dryRun: boolean;
  calls: GrantRoleCall[];
}

interface GrantRolesExecution {
  rpcUrl: string;
  calls: GrantRoleCall[];
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

function resolveGrantRolesExecution(request: GrantRolesRequest): GrantRolesExecution {
  if (!request.calls.length) {
    throw new Error("At least one grant_role call is required");
  }

  return {
    rpcUrl: resolveGrantRoleRpcUrl(request.chain, request.rpcUrl),
    calls: request.calls,
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

function resolveGrantRoleCredentials(
  request: Pick<GrantRolesRequest, "accountAddress" | "privateKey" | "context" | "chain">,
): GrantRoleExecutionCredentials {
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
  calls: GrantRoleCall[];
}): Promise<string> {
  const account = createGrantRoleAccount(params.chain, params.rpcUrl, params.credentials);
  const tx = await account.execute(params.calls);
  const receipt = await account.waitForTransaction(tx.transaction_hash);

  if (!wasGrantRoleSuccessful(receipt)) {
    throw new Error(`grant_role failed for tx ${tx.transaction_hash}`);
  }

  return tx.transaction_hash;
}

async function executeGrantRoleIfNeeded(
  request: GrantRolesRequest,
  execution: GrantRolesExecution,
): Promise<string | undefined> {
  if (request.dryRun) {
    return undefined;
  }

  return submitGrantRoleTransaction({
    chain: request.chain,
    rpcUrl: execution.rpcUrl,
    credentials: resolveGrantRoleCredentials(request),
    calls: execution.calls,
  });
}

function buildGrantRolesResult(
  request: GrantRolesRequest,
  execution: GrantRolesExecution,
  transactionHash?: string,
): GrantRolesResult {
  return {
    chain: request.chain,
    rpcUrl: execution.rpcUrl,
    transactionHash,
    dryRun: request.dryRun === true,
    calls: execution.calls,
  };
}

function buildGrantRoleResult(
  request: GrantRoleRequest,
  execution: GrantRolesExecution,
  transactionHash?: string,
): GrantRoleResult {
  const call = execution.calls[0];
  if (!call) {
    throw new Error("Expected a single grant_role call");
  }

  return {
    chain: request.chain,
    rpcUrl: execution.rpcUrl,
    contractAddress: request.contractAddress,
    role: request.role,
    recipient: request.recipient,
    transactionHash,
    dryRun: request.dryRun === true,
    call,
  };
}

function buildSingleGrantRolesRequest(request: GrantRoleRequest): GrantRolesRequest {
  return {
    chain: request.chain,
    calls: [buildGrantRoleCall(request.contractAddress, request.role, request.recipient)],
    rpcUrl: request.rpcUrl,
    accountAddress: request.accountAddress,
    privateKey: request.privateKey,
    context: request.context,
    dryRun: request.dryRun,
  };
}

export async function grantRoles(request: GrantRolesRequest): Promise<GrantRolesResult> {
  const execution = resolveGrantRolesExecution(request);
  const transactionHash = await executeGrantRoleIfNeeded(request, execution);
  return buildGrantRolesResult(request, execution, transactionHash);
}

export async function grantRole(request: GrantRoleRequest): Promise<GrantRoleResult> {
  const singleGrantRequest = buildSingleGrantRolesRequest(request);
  const execution = resolveGrantRolesExecution(singleGrantRequest);
  const transactionHash = await executeGrantRoleIfNeeded(singleGrantRequest, execution);
  return buildGrantRoleResult(request, execution, transactionHash);
}
