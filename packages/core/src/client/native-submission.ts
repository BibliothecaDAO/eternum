import {
  CallData,
  CairoCustomEnum,
  CairoOption,
  CairoOptionVariant,
  hash,
  shortString,
  type Call,
  type AccountInterface,
} from "starknet";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import type { NativeSubmission } from "@bibliothecadao/provider";
import type { NativeFactStore } from "./native-fact-store";

export interface SignedNativeIntent {
  intent: string[];
  r: string;
  s: string;
}

export interface NativeClientConnection {
  bindings: NativeWorldBindings;
  chainId: string;
  /** Signs with the connected player's existing gameplay key. */
  signIntent(actor: AccountInterface, digest: string): Promise<{ r: bigint; s: bigint }>;
  /** Acceptance time and entropy are assigned only by the sequencing service. */
  submitIntent(action: SignedNativeIntent): Promise<{ transaction_hash: string }>;
}

export function nativeSubmission(
  input: NativeClientConnection,
  store: NativeFactStore,
  gameId: number,
  season: string,
): NativeSubmission {
  const codec = new CallData(input.bindings.commandAbi);
  return async (actor, calls) => {
    const batch = Array.isArray(calls) ? calls : [calls];
    if (batch.length !== 1) throw new Error("Native execution accepts one command per action");
    const { command } = translateCommand(batch[0], gameId, season, store, BigInt(actor.address));
    const timestamp = Math.floor(Date.now() / 1_000);
    const arguments_ = codec.compile("command_commitment", { command });
    const intent = {
      chain: input.chainId,
      deployment: season,
      game_id: gameId,
      actor: actor.address,
      nonce: nextNonce(store, gameId, actor.address),
      command: taggedHash("ETERNUM_COMMAND", arguments_),
      rules: taggedHash(
        "ETERNUM_RULES",
        codec.compile("rules_commitment", { rules: store.require("SliceRules", { game_id: gameId }) }),
      ),
      // Admission records the last confirmed timestamp, which can precede the client clock.
      valid_from: 0,
      valid_until: timestamp + 300,
      // Admission expiry bounds waiting; another player's ticket must not invalidate this intent.
      last_order: 0xffffffffffffffffn,
      arguments: arguments_,
    };
    // The player signs fixed intent fields and the arguments span before transport.
    // Only the sequencing service constructs the execution envelope.
    const encoded = [
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
    ].map((value) => `0x${BigInt(value).toString(16)}`);
    const signature = await input.signIntent(actor, hash.computePoseidonHashOnElements(encoded));
    return input.submitIntent({
      intent: encoded,
      r: `0x${signature.r.toString(16)}`,
      s: `0x${signature.s.toString(16)}`,
    });
  };
}

function taggedHash(tag: string, fields: string[]): string {
  return hash.computePoseidonHashOnElements([shortString.encodeShortString(tag), 1, ...fields]);
}

function nextNonce(store: NativeFactStore, gameId: number, actor: string): bigint {
  const row = store.get("ActionNonce", { game_id: gameId, actor: BigInt(actor) });
  // Absence is the wire contract's initial nonce, after the confirmed snapshot has loaded.
  return row ? BigInt(row.next_nonce as bigint) : 0n;
}

function translateCommand(call: Call, gameId: number, season: string, store: NativeFactStore, actor: bigint) {
  if (BigInt(call.contractAddress) !== BigInt(season) || !Array.isArray(call.calldata))
    throw new Error("Invalid native command target");
  const [scope, ...args] = call.calldata;
  if (!["string", "number", "bigint"].includes(typeof scope)) throw new Error("Invalid native game id");
  if (BigInt(scope as string | number | bigint) !== BigInt(gameId)) throw new Error("Native command game mismatch");
  const build = (name: string, value: unknown) => ({ name, command: new CairoCustomEnum({ [name]: value }) });
  switch (call.entrypoint) {
    case "contribute_labor":
      if (args.length !== 2) break;
      return build("ContributeBitcoinLabor", { structure_id: args[0], amount: args[1] });
    case "close_bitcoin_phase":
    case "bind_bitcoin_phase":
      if (args.length !== 1) break;
      return build(call.entrypoint === "close_bitcoin_phase" ? "CloseBitcoinPhase" : "BindBitcoinPhase", args[0]);
    case "claim_phase_reward": {
      const count = Number(args[1]);
      if (!Number.isSafeInteger(count) || count < 1 || args.length !== count + 2) break;
      return build("ClaimBitcoinPhase", { phase: args[0], mine_ids: args.slice(2) });
    }
    case "settle_season":
      if (args.length === 2 && Number(args[1]) === 1)
        return build("SettleSeason", { name: args[0], selected_realm: new CairoOption(CairoOptionVariant.None) });
      if (args.length === 3 && Number(args[1]) === 0)
        return build("SettleSeason", {
          name: args[0],
          selected_realm: new CairoOption(CairoOptionVariant.Some, args[2]),
        });
      break;
    case "settle_village":
      if (args.length !== 2) break;
      return build("SettleVillage", { pass_id: args[0], connected_realm_entity_id: args[1] });
    case "settle_blitz": {
      const count = Number(args[3]);
      if (!Number.isSafeInteger(count) || count < 0 || args.length !== 5 + count * 3) break;
      if (![0, 1].includes(Number(args.at(-1)))) break;
      return build("SettleBlitz", {
        name: args[0],
        cosmetics_block_hash: args[1],
        cosmetics_block_number: args[2],
        cosmetics: Array.from({ length: count }, (_, index) => ({
          token_id: args[4 + index * 3],
          owner: args[5 + index * 3],
          attributes: args[6 + index * 3],
        })),
        grant_starting_troops: Number(args.at(-1)) === 1,
      });
    }
    case "provision_realm":
      if (args.length !== 1) break;
      return build("ProvisionRealm", args[0]);
    case "provision_and_upgrade_realm":
      if (args.length !== 1) break;
      return build("ProvisionAndUpgradeRealm", args[0]);
    case "create_hyperstructure":
      if (args.length !== 3) break;
      return build("CreateReservedHyperstructure", { alt: Number(args[0]) !== 0, x: args[1], y: args[2] });
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
      return build("Battle", { attacker_id: args[0], defender_id: args[1], steal_resources: resourceAmounts(args, 2) });
    case "attack_explorer_vs_guard":
      if (args.length !== 2) break;
      return build("BattleGuard", { attacker_id: args[0], defender_id: args[1] });
    case "attack_guard_vs_explorer":
      if (args.length !== 3) break;
      return build("GuardAttack", { guard: { structure_id: args[0], slot: args[1] }, explorer_id: args[2] });
    case "raid_explorer_vs_guard":
      return build("Raid", { explorer_id: args[0], structure_id: args[1], steal_resources: resourceAmounts(args, 3) });
    case "guard_add":
      if (args.length !== 5) break;
      return build(
        "ManageTroops",
        new CairoCustomEnum({
          RecruitGuard: {
            guard: { structure_id: args[0], slot: args[1] },
            category: unitEnum(args[2], ["Knight", "Paladin", "Crossbowman"]),
            tier: unitEnum(args[3], ["T1", "T2", "T3"]),
            amount: args[4],
          },
        }),
      );
    case "guard_delete":
      if (args.length !== 2) break;
      return build("ManageTroops", new CairoCustomEnum({ RemoveGuard: { structure_id: args[0], slot: args[1] } }));
    case "explorer_add":
      if (args.length !== 3) break;
      return build("ManageTroops", new CairoCustomEnum({ RecruitExplorer: { explorer_id: args[0], amount: args[1] } }));
    case "explorer_delete":
      if (args.length !== 1) break;
      return build("ManageTroops", new CairoCustomEnum({ RemoveExplorer: args[0] }));
    case "explorer_explorer_swap":
      if (args.length !== 4) break;
      return build("ManageTroops", troopTransfer(explorerArmy(args[0]), explorerArmy(args[1]), args[3]));
    case "explorer_guard_swap":
      if (args.length !== 5) break;
      return build("ManageTroops", troopTransfer(explorerArmy(args[0]), guardArmy(args[1], args[3]), args[4]));
    case "guard_explorer_swap":
      if (args.length !== 5) break;
      return build("ManageTroops", troopTransfer(guardArmy(args[0], args[1]), explorerArmy(args[2]), args[4]));
    case "explorer_extract_reward":
      if (args.length !== 1) break;
      return build("ExtractExplorationReward", args[0]);
    case "transfer_structure_ownership":
      if (args.length !== 2) break;
      return build("TransferStructureOwnership", { entity_id: args[0], new_owner: args[1] });
    case "transfer_agent_ownership":
      if (args.length !== 2) break;
      return build("TransferAgentOwnership", { entity_id: args[0], new_owner: args[1] });
    case "set_address_name":
      if (args.length !== 1) break;
      return build("SetAddressName", {
        owned_structure_id: ownedStructureWitness(store, gameId, actor),
        name: args[0],
      });
    case "level_up":
      if (args.length !== 1) break;
      return build("LevelUp", args[0]);
    case "create_order":
      if (args.length !== 8) break;
      return build("CreateTradeOrder", {
        maker_id: args[0],
        taker_id: args[1],
        offered_resource: args[2],
        requested_resource: args[3],
        offered_per_lot: args[4],
        requested_per_lot: args[6],
        lots: args[5],
        expires_at: args[7],
      });
    case "accept_order":
      if (args.length !== 3) break;
      return build("AcceptTradeOrder", { trade_id: args[1], taker_id: args[0], lots: args[2] });
    case "cancel_order":
      if (args.length !== 1) break;
      return build("CancelTradeOrder", args[0]);
    case "buy":
    case "sell":
      if (args.length !== 4) break;
      return build(call.entrypoint === "buy" ? "BuyFromBank" : "SellToBank", {
        bank_id: args[0],
        structure_id: args[1],
        resource_type: args[2],
        amount: args[3],
      });
    case "add":
      if (args.length !== 5) break;
      return build("AddBankLiquidity", {
        bank_id: args[0],
        structure_id: args[1],
        resource_type: args[2],
        resource_amount: args[3],
        lords_amount: args[4],
      });
    case "remove":
      if (args.length !== 4) break;
      return build("RemoveBankLiquidity", {
        bank_id: args[0],
        structure_id: args[1],
        resource_type: args[2],
        shares: args[3],
      });
    case "pledge_faith":
      if (args.length !== 2) break;
      return build("PledgeFaith", { structure_id: args[0], wonder_id: args[1] });
    case "remove_faith":
      if (args.length !== 1) break;
      return build("RemoveFaith", args[0]);
    case "update_wonder_ownership":
      if (args.length !== 1) break;
      return build("UpdateWonderOwnership", args[0]);
    case "update_structure_ownership":
      if (args.length !== 1) break;
      return build("UpdateFaithfulOwnership", args[0]);
    case "initialize":
      if (args.length !== 1) break;
      return build("InitializeHyperstructure", args[0]);
    case "contribute":
      if (args.length !== 3 || !Array.isArray(args[2])) break;
      return build("ContributeHyperstructure", {
        hyperstructure_id: args[0],
        from_structure_id: args[1],
        resources: args[2].map((resource) => ({ resource_type: resource.resource, amount: resource.amount })),
      });
    case "update_construction_access":
      if (args.length !== 2) break;
      return build("SetConstructionAccess", {
        hyperstructure_id: args[0],
        access: unitEnum(args[1], ["Public", "Private", "GuildOnly"]),
      });
    case "allocate_shares": {
      const count = Number(args[1]);
      if (!Number.isSafeInteger(count) || count < 0 || args.length !== 2 + count * 2) break;
      return build("AllocateHyperstructureShares", {
        hyperstructure_id: args[0],
        shareholders: Array.from({ length: count }, (_, i) => ({ player: args[2 + i * 2], bps: args[3 + i * 2] })),
      });
    }
    case "checkpoint_hyperstructures":
      if (args.length !== Number(args[0]) + 1) break;
      return build("CheckpointHyperstructures", args.slice(1));
    case "rank_players": {
      const count = Number(args[2]);
      if (!Number.isSafeInteger(count) || count < 1 || args.length !== count + 3) break;
      return build("RankPlayers", { trial_id: args[0], committed: args[1], players: args.slice(3) });
    }
    case "season_close":
      if (args.length !== 0) break;
      return build("CloseSeason", {});
    case "open_chest":
      if (args.length !== 4) break;
      return build("OpenRelicChest", {
        explorer_id: args[0],
        coord: { alt: booleanArgument(args[1]), x: args[2], y: args[3] },
      });
    case "apply_relic":
      if (args.length !== 3) break;
      return build("ApplyRelic", {
        entity_id: args[0],
        relic_id: args[1],
        recipient: unitEnum(args[2], ["Explorer", "StructureProduction", "StructureGuard"]),
      });
    case "burn_research_for_relic":
      if (args.length !== 1) break;
      return build("CraftRelic", args[0]);
    case "create_guild":
      if (args.length !== 2) break;
      return build("CreateGuild", {
        owned_structure_id: ownedStructureWitness(store, gameId, actor),
        public: booleanArgument(args[0]),
        name: args[1],
      });
    case "join_guild":
      if (args.length !== 1) break;
      return build("JoinGuild", { owned_structure_id: ownedStructureWitness(store, gameId, actor), guild_id: args[0] });
    case "update_whitelist":
      if (args.length !== 2) break;
      return build("SetGuildWhitelist", {
        player: args[0],
        owned_structure_id: ownedStructureWitness(store, gameId, actor),
        allowed: booleanArgument(args[1]),
      });
    case "remove_member":
      if (args.length !== 1) break;
      return build("RemoveGuildMember", args[0]);
    case "leave_guild":
      if (args.length !== 0) break;
      return build("LeaveGuild", {});
    case "structure_burn":
    case "troop_burn":
      return build(call.entrypoint === "structure_burn" ? "BurnStructureResources" : "BurnExplorerResources", {
        entity_id: args[0],
        resources: resourceAmounts(args, 1),
      });
    case "approve":
      return build("ApproveResources", {
        owner_entity_id: args[0],
        approved_entity_id: args[1],
        resources: resourceAmounts(args, 2),
      });
    case "send":
      return build("SendResources", transferResources(args));
    case "pickup":
      return build("PickupResources", transferResources([args[1], args[0], ...args.slice(2)]));
    case "troop_troop_adjacent_transfer":
      return build("TransferExplorerResources", transferResources(args));
    case "structure_troop_adjacent_transfer":
      return build("TransferStructureResourcesToExplorer", transferResources(args));
    case "troop_structure_adjacent_transfer":
      return build("TransferExplorerResourcesToStructure", transferResources(args));
    case "arrivals_offload":
      if (args.length !== 4) break;
      return build("OffloadArrival", { entity_id: args[0], day: args[1], slot: args[2], resource_count: args[3] });
    case "structure_regularize_weight":
      if (args.length !== Number(args[0]) + 1) break;
      return build("RegularizeResourceWeights", args.slice(1));
    case "claim_production":
      if (args.length !== 1) break;
      return build("ClaimProduction", args[0]);
    case "create_building": {
      const count = Number(args[1]);
      if (!Number.isSafeInteger(count) || count < 0 || args.length !== count + 4) break;
      return build("CreateBuilding", {
        structure_id: args[0],
        directions: args.slice(2, count + 2),
        category: args[count + 2],
        use_simple: booleanArgument(args[count + 3]),
      });
    }
    case "destroy_building":
    case "pause_building_production":
    case "resume_building_production": {
      if (args.length !== 4) break;
      const variant =
        call.entrypoint === "destroy_building"
          ? "DestroyBuilding"
          : call.entrypoint === "pause_building_production"
            ? "PauseBuildingProduction"
            : "ResumeBuildingProduction";
      return build(variant, {
        structure_id: args[0],
        coord: { alt: booleanArgument(args[1]), x: args[2], y: args[3] },
      });
    }
    case "burn_resource_for_labor_production":
      return build("BurnResourceForLaborProduction", productionRefill(args, false));
    case "burn_labor_for_resource_production":
      return build("BurnLaborForResourceProduction", productionRefill(args, true));
    case "burn_resource_for_resource_production":
      return build("BurnResourceForResourceProduction", productionRefill(args, false));
  }
  throw new Error(`Unsupported native action ${call.entrypoint}`);
}

function unitEnum(value: unknown, variants: string[]): CairoCustomEnum {
  if (!["string", "number", "bigint"].includes(typeof value)) throw new Error("Invalid native enum");
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= variants.length) throw new Error("Invalid native enum");
  return new CairoCustomEnum({ [variants[index]]: {} });
}

function explorerArmy(explorerId: unknown): CairoCustomEnum {
  return new CairoCustomEnum({ Explorer: explorerId });
}

function guardArmy(structureId: unknown, slot: unknown): CairoCustomEnum {
  return new CairoCustomEnum({ Guard: { structure_id: structureId, slot } });
}

function troopTransfer(source: CairoCustomEnum, target: CairoCustomEnum, amount: unknown): CairoCustomEnum {
  return new CairoCustomEnum({ Transfer: { source, target, amount } });
}

function booleanArgument(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (!["number", "string", "bigint"].includes(typeof value)) throw new Error("Invalid native boolean");
  const encoded = BigInt(value as string | number | bigint);
  if (encoded !== 0n && encoded !== 1n) throw new Error("Invalid native boolean");
  return encoded === 1n;
}

function productionRefill(args: unknown[], amountsFirst: boolean) {
  const count = args[1];
  if (!["string", "number", "bigint"].includes(typeof count)) throw new Error("Invalid native production list length");
  const length = Number(count);
  if (!Number.isSafeInteger(length) || length < 0 || args.length !== 3 + length * 2)
    throw new Error("Invalid native production list length");
  const secondCount = args[2 + length];
  if (!["string", "number", "bigint"].includes(typeof secondCount) || Number(secondCount) !== length)
    throw new Error("Invalid native production list length");
  const first = args.slice(2, 2 + length);
  const second = args.slice(3 + length);
  return {
    structure_id: args[0],
    resource_types: amountsFirst ? second : first,
    amounts: amountsFirst ? first : second,
  };
}

function transferResources(args: unknown[]) {
  return { from_entity_id: args[0], to_entity_id: args[1], resources: resourceAmounts(args, 2) };
}

function resourceAmounts(args: unknown[], offset: number) {
  const size = args[offset];
  if (!["string", "number", "bigint"].includes(typeof size)) throw new Error("Invalid native resource list length");
  const count = Number(size);
  if (!Number.isSafeInteger(count) || count < 0 || args.length !== offset + 1 + count * 2)
    throw new Error("Invalid native resource list length");
  return Array.from({ length: count }, (_, index) => ({
    resource_type: args[offset + 1 + index * 2],
    amount: args[offset + 2 + index * 2],
  }));
}

function ownedStructureWitness(store: NativeFactStore, gameId: number, actor: bigint): number {
  let witness: number | undefined;
  for (const row of store.structuresOwnedBy(gameId, actor)) {
    if (witness === undefined || row.entity_id < witness) witness = row.entity_id;
  }
  if (witness === undefined) throw new Error("Action requires an owned structure in the current game");
  return witness;
}

/** Follow one signed action to its retained transaction; retries never sign or admit a new action. */
export function createNativeTicketSubmission(baseUrl: string): NativeClientConnection["submitIntent"] {
  const actionsUrl = `${baseUrl.replace(/\/$/, "")}/actions`;
  return async (signed) => {
    const action = hash.computePoseidonHashOnElements(signed.intent);
    const signal = AbortSignal.timeout(20_000);
    const response = await admitSignedAction(actionsUrl, signed, signal);
    const accepted = await response.json();
    if (typeof accepted.action !== "string" || BigInt(accepted.action) !== BigInt(action))
      throw new Error("Admission returned a different action identity");
    const order = readTicketOrder(accepted.order);
    try {
      while (true) {
        signal.throwIfAborted();
        const statusResponse = await fetch(`${actionsUrl}/${action}`, { signal });
        if (!statusResponse.ok && statusResponse.status !== 503)
          throw new Error(`Ticket status unavailable (${statusResponse.status})`);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (
            typeof status.action !== "string" ||
            BigInt(status.action) !== BigInt(action) ||
            readTicketOrder(status.order) !== order
          )
            throw new Error("Ticket status identity mismatch");
          if (status.transaction_hash !== null) {
            if (typeof status.transaction_hash !== "string" || !/^0x[0-9a-f]+$/i.test(status.transaction_hash))
              throw new Error("Invalid ticket transaction hash");
            return { transaction_hash: status.transaction_hash };
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (cause) {
      throw new Error(
        `Action ${action} was accepted at order ${order}; tracking stopped. Do not submit a replacement.`,
        { cause },
      );
    }
  };
}

async function admitSignedAction(url: string, signed: SignedNativeIntent, signal: AbortSignal): Promise<Response> {
  const body = JSON.stringify(signed);
  while (true) {
    signal.throwIfAborted();
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal,
    });
    if (response.ok) return response;
    if (response.status !== 503) throw new Error(`Action admission rejected (${response.status})`);
    // Backpressure can outlast an HTTP request. Retry the same signed identity, never a new ticket.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function readTicketOrder(value: unknown): bigint {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error("Invalid ticket order");
  return BigInt(value);
}
