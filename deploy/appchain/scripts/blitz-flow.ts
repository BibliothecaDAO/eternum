// Retired by A2 — appchain launches go through the registrar; kept for mainnet-era reference.
/**
 * Drives a blitz game on the dev appchain end to end, headlessly.
 *
 *   bun deploy/appchain/scripts/blitz-flow.ts reserve   # admin, once per world
 *   bun deploy/appchain/scripts/blitz-flow.ts settle    # register + place realms
 *   bun deploy/appchain/scripts/blitz-flow.ts provision # provision each realm
 *   bun deploy/appchain/scripts/blitz-flow.ts status
 *   bun deploy/appchain/scripts/blitz-flow.ts all
 *
 * Why this exists: the config deploy path (config/deployer/config.ts) does NOT
 * reserve hyperstructure tiles — only the factory launcher does — and `settle`
 * asserts the reservation cursor is exhausted first. Without `reserve` every
 * settle reverts with "Reserve all hyperstructure tiles before settling realms".
 *
 * Env (RPC/Torii defaults target the AWS dev appchain; account credentials are required):
 *   RPC_URL, TORII_URL, ACCOUNT_ADDRESS, PRIVATE_KEY, PLAYER_NAME
 */
import manifest from "../../../contracts/l3/game/manifest_appchain_blitz.json";
import { resolveAccountCredentials } from "../../../config/deployer/clean/shared/credentials";
import { Account, CallData, RpcProvider, shortString } from "starknet";

const RPC_URL = process.env.RPC_URL ?? "http://52.54.98.119";
const TORII_URL = process.env.TORII_URL ?? "http://52.54.98.119:8081";
const { accountAddress: ACCOUNT_ADDRESS, privateKey: PRIVATE_KEY } = resolveAccountCredentials({
  accountAddress: process.env.ACCOUNT_ADDRESS,
  privateKey: process.env.PRIVATE_KEY,
  context: "retired appchain Blitz flow",
});
const PLAYER_NAME = process.env.PLAYER_NAME ?? "djizus";

const RESERVE_BATCH = 19; // matches config/deployer/clean/blitz/hyperstructure-reservation.ts

const contractByTag = (tag: string): string => {
  const found = (manifest as { contracts: { tag: string; address: string }[] }).contracts.find((c) => c.tag === tag);
  if (!found) throw new Error(`contract not found in manifest: ${tag}`);
  return found.address;
};

const BLITZ_REALM = contractByTag("s1_eternum-blitz_realm_systems");
const HYPERS_CREATE = contractByTag("s1_eternum-hyperstructure_create_systems");

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account({ provider, address: ACCOUNT_ADDRESS, signer: PRIVATE_KEY });

const sql = async (query: string): Promise<any[]> => {
  const res = await fetch(`${TORII_URL}/sql?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`torii sql ${res.status}: ${await res.text()}`);
  return res.json();
};

const send = async (label: string, contractAddress: string, entrypoint: string, calldata: string[]) => {
  const { transaction_hash } = await account.execute({ contractAddress, entrypoint, calldata });
  const receipt: any = await provider.waitForTransaction(transaction_hash);
  const status = receipt.execution_status ?? receipt.statusReceipt ?? "UNKNOWN";
  console.log(`  ${status === "REVERTED" ? "✗" : "✓"} ${label} ${transaction_hash} ${status}`);
  if (status === "REVERTED") throw new Error(receipt.revert_reason ?? "reverted");
  return receipt;
};

const worldConfig = async () => {
  const [row] = await sql(
    `SELECT "blitz_hypers_settlement_config.current_ring_count" AS ring,
            "blitz_hypers_settlement_config.max_ring_count" AS max_ring,
            "blitz_registration_config.registration_count" AS reg_count,
            "blitz_registration_config.registration_count_max" AS reg_max,
            "season_config.dev_mode_on" AS dev_mode,
            "season_config.start_main_at" AS start_main_at,
            "season_config.end_at" AS end_at
       FROM "s1_eternum-WorldConfig" LIMIT 1`,
  );
  return row;
};

const hex = (v: string | number) => (typeof v === "number" ? v : parseInt(String(v), 16));

async function status() {
  const c = await worldConfig();
  const now = Math.floor(Date.now() / 1000);
  console.log("world state:");
  console.log(`  hyperstructure rings   ${c.ring} / ${c.max_ring} ${Number(c.ring) > Number(c.max_ring) ? "(reserved ✓)" : "(NOT reserved — settle will revert)"}`);
  console.log(`  registrations          ${c.reg_count} / ${c.reg_max}`);
  console.log(`  dev mode               ${c.dev_mode ? "on (time gates bypassed; game never ends)" : "off"}`);
  console.log(`  main starts            ${new Date(hex(c.start_main_at) * 1000).toISOString()} (${hex(c.start_main_at) <= now ? "started" : "pending"})`);
  console.log(`  ends                   ${new Date(hex(c.end_at) * 1000).toISOString()} (${hex(c.end_at) <= now ? "ended" : "running"})`);

  const settlements = await sql(
    `SELECT player, structure_ids FROM "s1_eternum-BlitzSettlement" LIMIT 10`,
  ).catch(() => []);
  console.log(`  settlements            ${settlements.length}`);
  for (const s of settlements) console.log(`    ${s.player} -> ${s.structure_ids}`);
  return c;
}

async function reserve() {
  console.log("reserving hyperstructure tiles...");
  for (let i = 0; i < 12; i++) {
    const c = await worldConfig();
    if (Number(c.ring) > Number(c.max_ring)) {
      console.log(`  cursor exhausted (ring ${c.ring} > max ${c.max_ring})`);
      return;
    }
    await send(`reserve_hyperstructures(${RESERVE_BATCH})`, HYPERS_CREATE, "reserve_hyperstructures", [
      String(RESERVE_BATCH),
    ]);
    await new Promise((r) => setTimeout(r, 3000)); // let torii catch up before re-reading
  }
  throw new Error("reservation did not converge after 12 batches");
}

async function settle() {
  console.log(`settling as "${PLAYER_NAME}"...`);
  // [name, Option::None (variant 1), cosmetics_len 0, grant_starting_troops 1]
  const calldata = CallData.compile([shortString.encodeShortString(PLAYER_NAME), "1", "0", "1"]);
  await send("settle", BLITZ_REALM, "settle", calldata as string[]);
}

async function structureIds(): Promise<number[]> {
  // torii stores addresses zero-padded to 66 chars; single quotes because
  // double quotes are identifiers in sqlite, not string literals.
  const padded = "0x" + ACCOUNT_ADDRESS.replace(/^0x/, "").padStart(64, "0");
  const rows = await sql(
    `SELECT structure_ids FROM "s1_eternum-BlitzSettlement" WHERE player = '${padded}' LIMIT 1`,
  );
  if (!rows.length) return [];
  const raw = rows[0].structure_ids;
  return String(raw)
    .replace(/[[\]"\s]/g, "")
    .split(",")
    .filter(Boolean)
    .map((v) => (v.startsWith("0x") ? parseInt(v, 16) : Number(v)));
}

async function provision() {
  const ids = await structureIds();
  if (!ids.length) throw new Error("no BlitzSettlement rows for this account — run settle first (and let torii index)");
  console.log(`provisioning ${ids.length} realms: ${ids.join(", ")}`);
  for (const id of ids) {
    await send(`provision_realm(${id})`, BLITZ_REALM, "provision_realm", [String(id)]);
  }
}

const command = process.argv[2] ?? "status";
const run = async () => {
  console.log(`rpc:   ${RPC_URL}`);
  console.log(`torii: ${TORII_URL}`);
  console.log(`as:    ${ACCOUNT_ADDRESS}\n`);

  switch (command) {
    case "status":
      await status();
      break;
    case "reserve":
      await reserve();
      break;
    case "settle":
      await settle();
      break;
    case "provision":
      await provision();
      break;
    case "all":
      await reserve();
      await settle();
      await new Promise((r) => setTimeout(r, 5000)); // torii indexes the settlement
      await provision();
      console.log("");
      await status();
      break;
    default:
      throw new Error(`unknown command: ${command}`);
  }
};

run().catch((e) => {
  console.error(`\n✗ ${e.message ?? e}`);
  process.exit(1);
});
