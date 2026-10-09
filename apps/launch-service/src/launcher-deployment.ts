import { Effect } from "effect";
import { botRealmsId, realmsAccountAddress } from "@realms-world/identity/account";
import { joinRealmsAccount, deviceKeyOf } from "@bibliothecadao/eternum/realms-account";
import { rpcAt } from "@realms-world/value-ledger";
import { shortString } from "starknet";
import { readLaunchShard } from "./executor";
import { LaunchShard } from "./shard-client";
import { nativePresetForId } from "../../../config/source/native";
import {
  loadNativePresetConfiguration,
  nativeSeasonStart,
} from "../../../config/deployer/clean/registrar/native-preset";
import type { CreateGameRequest } from "./schemas";

interface Target {
  chainId: string;
  heraldUrl: string;
}
interface Check extends Target {
  name: string;
  presetId: number;
}
interface Environment {
  SHARD_URL: string;
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
interface Creation {
  presetId: number;
  createdAt: number;
  fromBlock: number;
  request: CreateGameRequest;
  txHash?: string;
}
const LABEL = shortString.encodeShortString("ETERNUM_LAUNCHER");

/** A fixed deployment proof, using the same Worker-held device as normal launches. */
export class LauncherDeployment {
  constructor(
    private readonly env: Environment,
    private readonly storage: Storage,
  ) {}
  async account(chainId: string): Promise<string | undefined> {
    return (await this.storage.get<Enrolled>(this.accountKey(chainId)))?.launcherAccount;
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
  async check(input: Check) {
    const shard = await this.target(input);
    const enrolled = await this.storage.get<Enrolled>(this.accountKey(input.chainId));
    if (!enrolled) throw new Error("launcher_not_enrolled");
    if (
      BigInt(enrolled.world) !== BigInt(shard.contracts.games!) ||
      BigInt(enrolled.classHash) !== BigInt(shard.accountClassHash) ||
      BigInt(enrolled.guardian) !== BigInt(shard.guardianPublicKey) ||
      BigInt(enrolled.deviceKey) !== BigInt(deviceKeyOf(this.env.DEPLOYER_PRIVATE_KEY).publicKey)
    )
      throw new Error("launcher_enrolment_differs");
    const native = new LaunchShard({
      rpcUrl: shard.rpcUrl,
      chainId: shard.chainId,
      gamesAddress: shard.contracts.games!,
      accountAddress: enrolled.launcherAccount,
      privateKey: this.env.DEPLOYER_PRIVATE_KEY,
    });
    if (BigInt(await native.view<bigint>("launcher", [])) !== BigInt(enrolled.launcherAccount))
      throw new Error("launcher_role_not_granted");
    const key = `launcher-check:${BigInt(input.chainId).toString(16)}:${input.name}`;
    let creation = await this.storage.get<Creation>(key);
    if (creation && creation.presetId !== input.presetId) throw new Error("launcher_check_identity_differs");
    if (!creation) {
      creation = await this.prepareCheck(native, input);
      await this.storage.put(key, creation);
    }
    return this.completeCheck(native, key, creation);
  }
  private async prepareCheck(native: LaunchShard, input: Check): Promise<Creation> {
    const preset = nativePresetForId(input.presetId);
    const head = await native.head();
    return buildCheckCreation(input, preset, head);
  }
  private async completeCheck(native: LaunchShard, key: string, creation: Creation) {
    if (creation.txHash) {
      await native.confirm(creation.txHash);
      if (!(await native.gameId(creation.request.gameName))) throw new Error("launcher_check_game_missing");
      return { txHash: creation.txHash };
    }
    if (await native.gameId(creation.request.gameName)) {
      const txHash = await native.creationTransaction(creation.request.gameName, creation.presetId, creation.fromBlock);
      creation.txHash = txHash;
      await this.storage.put(key, creation);
      return { txHash };
    }
    const result = await native.create(creation.request, creation.createdAt, async (txHash) => {
      await this.storage.put(key, { ...creation, txHash });
    });
    if (!result.createGameTxHash) throw new Error("launcher_check_hash_missing");
    creation.txHash = result.createGameTxHash;
    await this.storage.put(key, creation);
    return { txHash: creation.txHash };
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
    if (new URL(input.heraldUrl).href.replace(/\/$/, "") !== new URL(this.env.SHARD_URL).href.replace(/\/$/, ""))
      throw new Error("launcher_target_differs");
    const { shard } = await readLaunchShard(this.env.SHARD_URL);
    if (BigInt(shard.chainId) !== BigInt(input.chainId)) throw new Error("launcher_target_differs");
    return shard;
  }
  private accountKey(chainId: string) {
    return `launcher-account:${BigInt(chainId).toString(16)}`;
  }
}

const buildCheckCreation = (
  input: Check,
  preset: ReturnType<typeof nativePresetForId>,
  head: { timestamp: number; block_number: number },
): Creation => {
  const environment = `madara.${preset.environmentGameType}` as CreateGameRequest["environment"];
  const config = loadNativePresetConfiguration(environment, input.presetId);
  const start = nativeSeasonStart(config, { presetId: input.presetId, startMainAt: head.timestamp + 900 });
  return {
    presetId: input.presetId,
    createdAt: head.timestamp * 1000,
    fromBlock: head.block_number,
    request: {
      environment,
      gameName: input.name,
      version: String(input.presetId),
      gameStartTime: new Date(start * 1000).toISOString(),
      rosterAccounts: [],
      devModeOn: false,
    },
  };
};

export const deploymentOperation = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: () => new Error("launcher_deployment_failed") });
