import { hash, shortString } from "starknet";
import { normalize } from "./common";

interface ReceiptEvent {
  from_address: string;
  keys: string[];
  data: string[];
}
const models = ["Structure", "SiteChest", "LordsBudget", "ExpeditionDiscovery"] as const;
const rowSet = normalize(hash.getSelectorFromName("RowSet"));
const modelIds = Object.fromEntries(models.map((model) => [model, normalize(shortString.encodeShortString(model))]));

// Count genuine RowSet facts from this host and game, including nested library event selectors.
export function discoveryFacts(events: ReceiptEvent[], contract: string, game: number) {
  const counts = { Structure: 0, SiteChest: 0, LordsBudget: 0, ExpeditionDiscovery: 0 };
  for (const event of events) {
    if (normalize(event.from_address) !== normalize(contract) || !event.keys.some((key) => normalize(key) === rowSet))
      continue;
    const model = models.find((name) => modelIds[name] === normalize(event.keys.at(-1)!));
    if (!model || event.data.length < 2 || BigInt(event.data[1]!) !== BigInt(game)) continue;
    counts[model]++;
  }
  return counts;
}
