import {
  CallData,
  CairoCustomEnum,
  hash,
  shortString,
  uint256,
  type Call,
  type AccountInterface,
  type RawArgs,
} from "starknet";
import type { NativeWorldBindings, ContractComponents } from "@bibliothecadao/types";
import type { NativeSubmission } from "@bibliothecadao/provider";
import { nativeConfiguration, readNativeRow } from "./native-config";

export interface NativeClientConnection {
  bindings: NativeWorldBindings;
  chainId: string;
  /** Signs with the connected player's existing gameplay key. */
  signIntent(actor: AccountInterface, digest: string): Promise<{ r: bigint; s: bigint }>;
  /** Raw-root injection belongs to the lab or the sequencing transport. */
  executionContext(
    command: string,
    actor: AccountInterface,
  ): { rawRoot: bigint; timestamp: number; authorityEpoch: number; acceptedPublicKey: string; l2Gas: bigint };
  submit(call: Call): Promise<{ transaction_hash: string }>;
}

export function nativeSubmission(
  input: NativeClientConnection,
  components: ContractComponents,
  gameId: number,
  season: string,
): NativeSubmission {
  const codec = new CallData(input.bindings.commandAbi);
  return async (actor, calls) => {
    const batch = Array.isArray(calls) ? calls : [calls];
    if (batch.length !== 1) throw new Error("The native slice accepts one command per action");
    const { name, command } = translateCommand(batch[0], gameId, season);
    const context = input.executionContext(name, actor);
    const arguments_ = codec.compile("command_commitment", { command });
    const position = executionPosition(components, season);
    const intent = {
      chain: input.chainId,
      deployment: season,
      game_id: gameId,
      actor: actor.address,
      nonce: nextNonce(components, gameId, actor.address),
      command: taggedHash("ETERNUM_COMMAND", arguments_),
      rules: taggedHash(
        "ETERNUM_RULES",
        codec.compile("rules_commitment", { rules: nativeConfiguration(components, gameId).rules() }),
      ),
      valid_from: context.timestamp,
      valid_until: context.timestamp + 300,
      last_order: position.order + 1n,
      arguments: arguments_,
    };
    const digest = intentIdentity(intent);
    const signature = await input.signIntent(actor, digest);
    const envelope = buildEnvelope(codec, components, season, context, position, digest);
    return input.submit({
      contractAddress: season,
      entrypoint: "execute",
      calldata: codec.compile("execute", {
        intent,
        context: { envelope, authority_epoch: context.authorityEpoch, accepted_public_key: context.acceptedPublicKey },
        r: signature.r,
        s: signature.s,
      }),
    });
  };
}

function buildEnvelope(
  codec: CallData,
  components: ContractComponents,
  season: string,
  context: ReturnType<NativeClientConnection["executionContext"]>,
  position: ReturnType<typeof executionPosition>,
  digest: string,
) {
  const domain = readNativeRow(components, "DomainState", [BigInt(season)]);
  if (!domain) throw new Error("Native DomainState is not synchronized");
  const executionConfig = taggedHash(
    "ETERNUM_EXECUTION",
    codec.compile("configure", { peers: domain.peers as RawArgs }),
  );
  const root = uint256.bnToUint256(context.rawRoot);
  return [
    shortString.encodeShortString("ETERNUM_ENTROPY"),
    1,
    digest,
    position.order + 1n,
    position.binding,
    position.state,
    context.timestamp,
    executionConfig,
    context.l2Gas,
    root.low,
    root.high,
  ];
}

function taggedHash(tag: string, fields: string[]): string {
  return hash.computePoseidonHashOnElements([shortString.encodeShortString(tag), 1, ...fields]);
}

function intentIdentity(intent: {
  chain: string;
  deployment: string;
  game_id: number;
  actor: string;
  nonce: bigint;
  command: string;
  rules: string;
  valid_from: number;
  valid_until: number;
  last_order: bigint;
  arguments: string[];
}): string {
  return hash.computePoseidonHashOnElements([
    shortString.encodeShortString("ETERNUM_ACTION"),
    1,
    intent.chain,
    intent.deployment,
    intent.game_id,
    intent.actor,
    intent.nonce,
    intent.command,
    intent.rules,
    intent.valid_from,
    intent.valid_until,
    intent.last_order,
    intent.arguments.length,
    ...intent.arguments,
  ]);
}

function nextNonce(components: ContractComponents, gameId: number, actor: string): bigint {
  const row = readNativeRow(components, "ActionNonce", [BigInt(gameId), BigInt(actor)]);
  // Absence is the wire contract's initial nonce, after the confirmed snapshot has loaded.
  return row ? BigInt(row.next_nonce as bigint) : 0n;
}

function executionPosition(components: ContractComponents, season: string) {
  const row = readNativeRow(components, "ExecutionHead", [BigInt(season)]);
  // A deployment has no execution head before its first accepted action.
  return row
    ? { order: BigInt(row.order as bigint), binding: BigInt(row.binding as bigint), state: BigInt(row.state as bigint) }
    : { order: 0n, binding: 0n, state: 0n };
}

function translateCommand(call: Call, gameId: number, season: string) {
  if (BigInt(call.contractAddress) !== BigInt(season) || !Array.isArray(call.calldata))
    throw new Error("Invalid native command target");
  const [scope, ...args] = call.calldata;
  if (!["string", "number", "bigint"].includes(typeof scope)) throw new Error("Invalid native game id");
  if (BigInt(scope as string | number | bigint) !== BigInt(gameId)) throw new Error("Native command game mismatch");
  const build = (name: string, value: unknown) => ({ name, command: new CairoCustomEnum({ [name]: value }) });
  switch (call.entrypoint) {
    case "explorer_create":
      if (args.length !== 5) break;
      return build("CreateExplorer", {
        structure_id: args[0],
        category: args[1],
        tier: args[2],
        amount: args[3],
        direction: args[4],
      });
    case "explorer_move": {
      if (args.length !== 3 || !Array.isArray(args[1])) break;
      if (Number(args[2]) === 0) return build("Move", { explorer_id: args[0], directions: args[1] });
      if (Number(args[2]) === 1 && args[1].length === 1)
        return build("Explore", { explorer_id: args[0], direction: args[1][0] });
      break;
    }
    case "toggle_alternate":
      if (args.length !== 2) break;
      return build("ToggleAlternate", { explorer_id: args[0], spire_direction: args[1] });
    case "attack_explorer_vs_explorer":
      if (args.length !== 3 || Number(args[2]) !== 0) break;
      return build("Battle", { attacker_id: args[0], defender_id: args[1] });
    case "claim_production":
      if (args.length !== 1) break;
      return build("ClaimProduction", args[0]);
  }
  throw new Error(`Unsupported native slice action ${call.entrypoint}`);
}
