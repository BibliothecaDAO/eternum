import { Account, CallData, RpcProvider, uint256, type Call } from "starknet";
import { accountIdentity, balance, classAt, send, type Keys } from "./chain";
import { reportFailure } from "./deploy";
import { PublicError } from "./errors";
import { existingAssets, hasLedgerRole, LEDGER_ROLES, startingReserve } from "./ledger";
import { PrivateStore } from "./private-store";
import { runSteps, type Step } from "./run";
import { environments, ownsValueLedger, root, STRK, WEI, type Inputs } from "./settings";

/**
 * While production shares dev's book, dev's deployer is the ledger's admin. Before production's setup can accept that
 * ledger, the admin funds production's deployer up to its starting reserve, gives it the admin role and production's
 * relay the operator role, and takes the pause role from dev's monitor, so a dev halt cannot stop production's payouts.
 * Each balance and role is read first and only a missing change is sent, so the command can run again at any point.
 * Without --apply it only reads.
 *
 *   pnpm run shared-ledger /abs/dev-private-directory /abs/production-private-directory [--apply]
 */
export async function main() {
  const { devDirectory, productionDirectory, apply } = parseArguments(process.argv.slice(2));
  if (ownsValueLedger(environments.dev))
    throw new PublicError("Production names its own book; it shares no ledger with dev");
  const dev = new PrivateStore(devDirectory, root, true);
  const production = new PrivateStore(productionDirectory, root);
  const inputs = dev.read<Inputs>("inputs.json");
  const devKeys = dev.read<Keys>("keys.json");
  const productionKeys = production.read<Keys>("keys.json");
  if (!inputs || !devKeys) throw new PublicError("The dev private directory has no inputs or keys");
  if (!productionKeys) throw new PublicError("Run production setup until it has created its accounts");
  const ledger = existingAssets(environments.dev).ledger;
  if (!ledger) throw new PublicError("dev's book names no ledger");
  const provider = new RpcProvider({ nodeUrl: inputs.rpc, blockIdentifier: "latest" });
  const admin = new Account({
    provider,
    address: accountIdentity(devKeys.deployer).address,
    signer: devKeys.deployer,
  });
  const unlock = dev.lock();
  try {
    const context = { provider, admin, ledger, store: dev, output: console.log };
    await runSteps(
      [
        reserveStep(context, accountIdentity(productionKeys.deployer).address),
        ...roleSteps(context, sharedLedgerRoles(devKeys, productionKeys)),
      ],
      apply,
      console.log,
    );
  } finally {
    unlock();
  }
}

interface RoleChange {
  name: string;
  role: string;
  address: string;
  /** Whether the account should hold the role once the change is made. */
  granted: boolean;
}

/** The roles production's accounts need on dev's ledger, and the pause role dev's monitor gives up. */
export function sharedLedgerRoles(devKeys: Keys, productionKeys: Keys): RoleChange[] {
  const address = (key: string) => accountIdentity(key).address;
  return [
    {
      name: "admin role for production's deployer",
      role: LEDGER_ROLES.admin,
      address: address(productionKeys.deployer),
      granted: true,
    },
    {
      name: "operator role for production's relay",
      role: LEDGER_ROLES.operator,
      address: address(productionKeys.relay),
      granted: true,
    },
    {
      name: "no pause role for dev's monitor",
      role: LEDGER_ROLES.pauser,
      address: address(devKeys.monitor),
      granted: false,
    },
  ];
}

interface RoleContext {
  provider: RpcProvider;
  admin: Account;
  ledger: string;
  store: PrivateStore;
  output: (line: string) => void;
}

/** Production's deployer holds its starting reserve before its account exists; dev's deployer sends only the shortfall. */
export function reserveStep(context: RoleContext, deployer: string): Step {
  const reserve = startingReserve(environments.production);
  return {
    name: "STRK reserve for production's deployer",
    payer: "dev deployer",
    cost: `up to ${reserve / WEI} STRK, moved between the run's own accounts`,
    inspect: async () => {
      const deployed = await classAt(context.provider, deployer);
      const held = await balance(context.provider, STRK, deployer);
      return {
        done: !!deployed || held >= reserve,
        detail: deployed ? `${deployer} is deployed` : `${deployer} holds ${held / WEI} of ${reserve / WEI} STRK`,
      };
    },
    apply: async () => {
      const head = await context.provider.getBlockNumber();
      const missing = reserve - (await balance(context.provider, STRK, deployer, head));
      if (missing <= 0n) return;
      if ((await balance(context.provider, STRK, context.admin.address, head)) < missing)
        throw new PublicError("dev's deployer holds less STRK than production's deployer is missing; nothing was sent");
      const transfer = {
        contractAddress: STRK,
        entrypoint: "transfer",
        calldata: CallData.compile([deployer, uint256.bnToUint256(missing)]),
      };
      await send(context.admin, [transfer], context.store, "shared-ledger-reserve", context.output, head);
    },
  };
}

export function roleSteps(context: RoleContext, changes: RoleChange[]): Step[] {
  return changes.map((change) => ({
    name: change.name,
    payer: "dev deployer (ledger admin)",
    cost: "one small mainnet transaction",
    inspect: async () => {
      const held = await hasLedgerRole(context.provider, context.ledger, change.role, change.address);
      return {
        done: held === change.granted,
        detail: `${change.address} ${held ? "holds" : "does not hold"} the role`,
      };
    },
    apply: async () => {
      const head = await context.provider.getBlockNumber();
      if (!(await hasLedgerRole(context.provider, context.ledger, LEDGER_ROLES.admin, context.admin.address, head)))
        throw new PublicError("dev's deployer is not the ledger admin; nothing was sent");
      await send(
        context.admin,
        [roleCall(context.ledger, change)],
        context.store,
        "shared-ledger",
        context.output,
        head,
      );
    },
  }));
}

const roleCall = (ledger: string, change: RoleChange): Call => ({
  contractAddress: ledger,
  entrypoint: change.granted ? "grant_role" : "revoke_role",
  calldata: CallData.compile([change.role, change.address]),
});

function parseArguments(values: string[]) {
  const apply = values.includes("--apply");
  const [devDirectory, productionDirectory, ...extra] = values.filter((value) => value !== "--apply");
  if (!devDirectory || !productionDirectory || extra.length)
    throw new PublicError(
      "Usage: pnpm run shared-ledger /absolute/dev-private-directory /absolute/production-private-directory [--apply]",
    );
  return { devDirectory, productionDirectory, apply };
}

if (import.meta.main) main().catch(reportFailure);
