/**
 * Retires an environment's deployed contracts so setup deploys new ones: each pin moves aside in the private
 * directory, and its address leaves the public book (the ledger's deployment block with it). Run it twice and the
 * second run finds nothing to do; a run cut short completes on the next.
 *
 *   pnpm run retire <dev|production> /absolute/private-directory <ledger|mmr|chests|cosmetics>... [--apply]
 *
 * The test token is never retired: the book's `lords` names the token the new ledger takes.
 */
import { num } from "starknet";
import { addressBook, environments, root, type Environment, type Target } from "./settings";
import { retiredPin, writeAddressBook, type Assets } from "./ledger";
import { PrivateStore } from "./private-store";
import { PublicError, reportFailure } from "./errors";

/** The contracts setup can replace, each by the book key that names it. */
const BOOK_KEYS = {
  ledger: ["ledger", "ledgerDeploymentBlock"],
  mmr: ["mmrToken"],
  chests: ["lootChests"],
  cosmetics: ["cosmetics"],
} as const;
type Retirable = keyof typeof BOOK_KEYS;
/** What the ledger's admin was given to sign belongs to that ledger, so it retires with it. */
const LEDGER_CALL_FILES = ["cold-setup", "cold-funding"];

/** The changes retiring `names` makes: pins and call files moved aside, book keys removed. */
export function retirementPlan(target: Target, store: PrivateStore, names: readonly Retirable[]) {
  const book = addressBook(target);
  const moves: [string, string][] = [];
  const keys: string[] = [];
  for (const name of names) {
    const pin = store.read<{ address: string }>(`asset-${name}.json`);
    const address = book[BOOK_KEYS[name][0]] || pin?.address;
    if (!address) continue;
    if (pin && BigInt(pin.address) !== BigInt(address))
      throw new PublicError(`The saved ${name} pin names another contract than the book; nothing was retired`);
    if (pin) moves.push([`asset-${name}.json`, retiredPin(name as keyof Assets, address)]);
    if (name === "ledger")
      for (const file of LEDGER_CALL_FILES)
        if (store.read(`${file}.json`)) moves.push([`${file}.json`, `retired-${file}-${num.toHex(address)}.json`]);
    keys.push(...BOOK_KEYS[name].filter((key) => key in book));
  }
  return { moves, keys };
}

/** Moves the pins aside first, then removes the book keys, so a run cut short leaves nothing the next run can't finish. */
export function retire(target: Target, store: PrivateStore, plan: ReturnType<typeof retirementPlan>) {
  for (const [from, to] of plan.moves) store.rename(from, to);
  if (!plan.keys.length) return;
  const book: Record<string, string | number> = addressBook(target);
  for (const key of plan.keys) delete book[key];
  writeAddressBook(target, book);
}

function main(args = process.argv.slice(2)) {
  const apply = args.at(-1) === "--apply";
  const [environment, directory, ...names] = apply ? args.slice(0, -1) : args;
  if (
    (environment !== "dev" && environment !== "production") ||
    !directory ||
    !names.length ||
    names.some((name) => !(name in BOOK_KEYS))
  )
    throw new PublicError(
      "Usage: pnpm run retire <dev|production> /absolute/private-directory <ledger|mmr|chests|cosmetics>... [--apply]",
    );
  const target = environments[environment as Environment];
  const store = new PrivateStore(directory, root, apply);
  const plan = retirementPlan(target, store, names as Retirable[]);
  for (const [from, to] of plan.moves) console.log(`move ${from} → ${to}`);
  for (const key of plan.keys) console.log(`remove ${key} from contracts/common/addresses/${target.book}`);
  if (!plan.moves.length && !plan.keys.length) return console.log("Nothing to retire.");
  if (!apply) return console.log("DRY RUN: nothing moved or removed. Use --apply to act.");
  retire(target, store, plan);
  console.log("Retired. Run setup to deploy the new contracts.");
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    reportFailure(error);
  }
}
