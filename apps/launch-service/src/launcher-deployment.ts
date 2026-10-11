import { Effect } from "effect";
import { botRealmsId, realmsAccountAddress } from "@realms-world/identity/account";
import { joinRealmsAccount, deviceKeyOf } from "@bibliothecadao/eternum/realms-account";
import { rpcAt } from "@realms-world/value-ledger";
import { shortString } from "starknet";
import { readLaunchShard } from "./executor";
import { LaunchShard } from "./shard-client";
interface Target {
  chainId: string;
  heraldUrl: string;
}
interface Environment {
  VALUE_IDENTITY: import("@realms-world/value-ledger").ShardDirectory;
  BASE_URL: string;
  DEPLOYER_PRIVATE_KEY: string;
  OPERATOR_TOKEN: string;
  IDENTITY: Pick<Fetcher, "fetch">;
}
interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<unknown>;
}
interface Enrolled {
  chainId: string;
  launcherAccount: string;
  classHash: string;
  guardian: string;
  deviceKey: string;
  world: string;
}
const LABEL = shortString.encodeShortString("ETERNUM_LAUNCHER");

/** Enrolls the Worker-held device and verifies its launcher role on chain. */
export class LauncherDeployment {
  constructor(
    private readonly env: Environment,
    private readonly storage: Storage,
  ) {}
  async account(chainId: string): Promise<string> {
    const enrolled = await this.storage.get<Enrolled>(this.accountKey(chainId));
    if (!enrolled) throw new Error("launcher_role_not_granted");
    const { shard } = await readLaunchShard(this.env.VALUE_IDENTITY, chainId);
    if (shard.status === "retired") throw new Error("launcher_target_differs");
    const native = new LaunchShard({
      rpcUrl: shard.rpcUrl,
      chainId: shard.chainId,
      gamesAddress: shard.contracts.games!,
      accountAddress: enrolled.launcherAccount,
      privateKey: this.env.DEPLOYER_PRIVATE_KEY,
    });
    if (BigInt(await native.view<bigint>("launcher", [])) !== BigInt(enrolled.launcherAccount))
      throw new Error("launcher_role_not_granted");
    return enrolled.launcherAccount;
  }
  async enrol(input: Target) {
    const shard = await this.target(input);
    const previous = await this.storage.get<Enrolled>(this.accountKey(input.chainId));
    const realmsId = botRealmsId(LABEL);
    const launcherAccount = realmsAccountAddress(realmsId, shard.accountClassHash, shard.guardianPublicKey);
    await this.assertIdentity(shard);
    const record: Enrolled = {
      chainId: shard.chainId,
      launcherAccount,
      classHash: shard.accountClassHash,
      guardian: shard.guardianPublicKey,
      deviceKey: deviceKeyOf(this.env.DEPLOYER_PRIVATE_KEY).publicKey,
      world: shard.contracts.games!,
    };
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(record)) throw new Error("launcher_enrolment_differs");
      return { chainId: record.chainId, launcherAccount };
    }
    const account = await this.join(shard, realmsId);
    if (BigInt(account.address) !== BigInt(launcherAccount)) throw new Error("launcher_account_differs");
    await this.storage.put(this.accountKey(input.chainId), record);
    return { chainId: record.chainId, launcherAccount };
  }
  private async assertIdentity(shard: Awaited<ReturnType<typeof readLaunchShard>>["shard"]) {
    if (BigInt(await rpcAt(shard.rpcUrl).getChainId()) !== BigInt(shard.chainId))
      throw new Error("launcher_chain_differs");
    const identity = await this.env.IDENTITY.fetch(new URL("/api/guardian", this.env.BASE_URL));
    if (!identity.ok) throw new Error("launcher_identity_unavailable");
    const pins = (await identity.json()) as { accountClassHash: string; publicKey: string };
    if (
      BigInt(pins.accountClassHash) !== BigInt(shard.accountClassHash) ||
      BigInt(pins.publicKey) !== BigInt(shard.guardianPublicKey)
    )
      throw new Error("launcher_identity_differs");
  }
  private join(shard: Awaited<ReturnType<typeof readLaunchShard>>["shard"], realmsId: string) {
    return joinRealmsAccount({
      provider: rpcAt(shard.rpcUrl) as unknown as Parameters<typeof joinRealmsAccount>[0]["provider"],
      shard,
      realmsId,
      device: deviceKeyOf(this.env.DEPLOYER_PRIVATE_KEY),
      approve: async (change) => {
        const response = await this.env.IDENTITY.fetch(new URL("/api/devices/bots", this.env.BASE_URL), {
          method: "POST",
          headers: { authorization: `Bearer ${this.env.OPERATOR_TOKEN}`, "content-type": "application/json" },
          body: JSON.stringify({ label: LABEL, ...change }),
        });
        if (!response.ok) throw new Error("launcher_approval_refused");
        return ((await response.json()) as { signature: string[] }).signature;
      },
    });
  }
  private async target(input: Target) {
    const { shard } = await readLaunchShard(this.env.VALUE_IDENTITY, input.chainId);
    if (
      shard.status === "retired" ||
      new URL(input.heraldUrl).href.replace(/\/$/, "") !== new URL(shard.url).href.replace(/\/$/, "")
    )
      throw new Error("launcher_target_differs");
    return shard;
  }
  private accountKey(chainId: string) {
    return `launcher-account:${BigInt(chainId).toString(16)}`;
  }
}

export const deploymentOperation = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: () => new Error("launcher_deployment_failed") });
