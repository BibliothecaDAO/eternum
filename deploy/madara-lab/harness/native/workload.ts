import { setTimeout as sleep } from "node:timers/promises";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { shortString, hash, type Account } from "starknet";
import type { GameClient } from "@bibliothecadao/eternum";
import { gameEntityKey } from "@bibliothecadao/eternum";

interface SliceWorkload {
  client: GameClient;
  players: Account[];
  homes: number[];
  act(name: string, layer: "surface" | "ethereal", action: () => Promise<unknown>): Promise<void>;
  time(): number;
  prepareExplore(bot: number): Promise<void>;
  claim(): Promise<unknown>;
  explore(bot: number, explorerId: number, direction: number): Promise<unknown>;
}

/** Both deployments exercise the same actions and assert their results in the shared client's RECS world. */
export async function playSlice(input: SliceWorkload) {
  await createExplorer(input, 0);
  await createExplorer(input, 1);
  const defeatedExplorer = await resolveBattle(input);
  await createExplorer(input, 1);
  await enterEthereal(input);
  const surfaceMine = await discover(input, 0);
  const bitcoinMine = await discover(input, 1);
  await claimProduction(input);
  await transferRealmAndReturn(input);
  await namePlayer(input);
  await upgradeRealm(input);
  await verifyReconnect(input);
  return { defeatedExplorer, surfaceMine, bitcoinMine, ownershipTransferred: true, reconnected: true };
}

function explorer(input: SliceWorkload, bot: number) {
  const rows = input.client.views.explorers(input.homes[bot]);
  if (rows.length !== 1) throw new Error(`Bot ${bot} must own exactly one explorer`);
  return rows[0];
}

async function waitForStamina(input: SliceWorkload, bot: number, required: number) {
  const deadline = Date.now() + 360_000;
  while (Date.now() < deadline) {
    const current = explorer(input, bot);
    const stamina = input.client.views.stamina(current.entityId).getStamina(Math.floor(input.time() / 60));
    if (Number(stamina.amount) >= required) return;
    await sleep(1000);
  }
  throw new Error(`Bot ${bot} did not regenerate stamina`);
}

async function createExplorer(input: SliceWorkload, bot: number) {
  await input.act("create_explorer", "surface", () =>
    input.client.setup.systemCalls.explorer_create({
      signer: input.players[bot],
      for_structure_id: input.homes[bot],
      category: 0,
      tier: 0,
      amount: bot === 0 ? 100000000000 : 1000000000,
      spawn_direction: bot === 0 ? 0 : 3,
    }),
  );
}

async function resolveBattle(input: SliceWorkload): Promise<number> {
  await waitForStamina(input, 0, 50);
  const defender = explorer(input, 1).entityId;
  await input.act("battle", "surface", () =>
    input.client.setup.systemCalls.attack_explorer_vs_explorer({
      signer: input.players[0],
      aggressor_id: explorer(input, 0).entityId,
      defender_id: defender,
      steal_resources: [],
    }),
  );
  const key = gameEntityKey([BigInt(defender)]);
  if (getComponentValue(input.client.setup.components.ExplorerTroops, key))
    throw new Error("Battle did not delete the defeated explorer");
  if (input.client.views.resources(defender).hasResources())
    throw new Error("Battle did not delete the defeated explorer's resources");
  return defender;
}

async function enterEthereal(input: SliceWorkload) {
  await input.act("ethereal_entry", "ethereal", () =>
    input.client.setup.systemCalls.toggle_alternate({
      signer: input.players[1],
      explorer_id: explorer(input, 1).entityId,
      spire_direction: 2,
    }),
  );
  if (!explorer(input, 1).position.alt) throw new Error("Second bot did not enter Ethereal");
}

async function discover(input: SliceWorkload, bot: number): Promise<number> {
  const category = bot === 0 ? 4 : 8;
  const { Structure } = input.client.setup.components;
  const discoveries = () => [...runQuery([HasValue(Structure, { game_id: input.client.gameId, category })])];
  for (let attempt = 0; attempt < 8 && discoveries().length === 0; attempt++) {
    await waitForStamina(input, bot, 30);
    await input.prepareExplore(bot);
    await input.act("explore", bot === 0 ? "surface" : "ethereal", () =>
      input.explore(bot, explorer(input, bot).entityId, unexploredDirection(input, bot)),
    );
  }
  const entity = discoveries()[0];
  if (!entity) throw new Error(`Missing discovery category ${category} after eight original-pool rolls`);
  const structure = getComponentValue(Structure, entity)!;
  if (structure.base.troop_guard_count === 0) throw new Error("Discovered mine has no guards");
  if (bot === 0) {
    const production = input.client.views
      .resources(structure.entity_id)
      .getActiveProductions()
      .find((production) => production.resourceId === 24);
    if (!production || production.outputAmountLeft === 0n) throw new Error("Discovered mine has no production cap");
  }
  return structure.entity_id;
}

async function claimProduction(input: SliceWorkload) {
  const balance = () => input.client.views.resources(input.homes[0]).balance(24);
  const before = BigInt(balance());
  await input.act("claim_production", "surface", input.claim);
  if (BigInt(balance()) <= before) throw new Error("Production claim did not increase Earthen Shard balance");
}

async function verifyReconnect(input: SliceWorkload) {
  const before = explorer(input, 1).entityId;
  await input.client.recover();
  if (explorer(input, 1).entityId !== before || !explorer(input, 1).position.alt)
    throw new Error("Reconnect lost the Ethereal explorer");
}

function unexploredDirection(input: SliceWorkload, bot: number): number {
  const position = explorer(input, bot).position;
  const stride = position.alt ? 15 : 1;
  const even = position.y % 2 === 0;
  const offsets = [
    [1, 0],
    [even ? 1 : 0, 1],
    [even ? 0 : -1, 1],
    [-1, 0],
    [even ? 0 : -1, -1],
    [even ? 1 : 0, -1],
  ];
  const preferred = bot === 0 ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
  for (const direction of preferred) {
    const [dx, dy] = offsets[direction];
    const row = getComponentValue(
      input.client.setup.components.TileOpt,
      gameEntityKey([position.alt ? 1n : 0n, BigInt(position.x + dx * stride), BigInt(position.y + dy * stride)]),
    );
    if (!row || (BigInt(row.data) >> 41n) % 256n === 0n) return direction;
  }
  throw new Error(`Bot ${bot} has no adjacent unexplored tile`);
}

async function transferRealmAndReturn(input: SliceWorkload) {
  const key = gameEntityKey([BigInt(input.homes[0])]);
  for (const [from, to] of [
    [0, 1],
    [1, 0],
  ]) {
    await input.act("transfer_structure_ownership", "surface", () =>
      input.client.setup.systemCalls.transfer_structure_ownership({
        signer: input.players[from],
        structure_id: input.homes[0],
        new_owner: input.players[to].address,
      }),
    );
    const structure = getComponentValue(input.client.setup.components.Structure, key);
    if (!structure || BigInt(structure.owner) !== BigInt(input.players[to].address))
      throw new Error("Ownership transfer did not reach the shared client");
  }
}

async function namePlayer(input: SliceWorkload) {
  const name = shortString.encodeShortString("Surface player");
  await input.act("set_address_name", "surface", () =>
    input.client.setup.systemCalls.set_address_name({ signer: input.players[0], name }),
  );
  const address = BigInt(input.players[0].address);
  const row = getComponentValue(
    input.client.setup.components.AddressName,
    hash.computePoseidonHashOnElements([address]) as import("@dojoengine/recs").Entity,
  );
  if (!row || BigInt(row.name) !== BigInt(name)) throw new Error("Player name did not reach the shared client");
}

async function upgradeRealm(input: SliceWorkload) {
  const key = gameEntityKey([BigInt(input.homes[0])]);
  const before = getComponentValue(input.client.setup.components.Structure, key);
  if (!before) throw new Error("Missing realm before upgrade");
  await input.act("level_up", "surface", () =>
    input.client.setup.systemCalls.upgrade_realm({
      signer: input.players[0],
      realm_entity_id: input.homes[0],
    }),
  );
  const after = getComponentValue(input.client.setup.components.Structure, key);
  if (
    !after ||
    after.base.level !== before.base.level + 1 ||
    after.base.troop_max_explorer_count !== 3 ||
    after.base.troop_max_guard_count !== 2
  )
    throw new Error("Realm upgrade did not reach the shared client");
}
