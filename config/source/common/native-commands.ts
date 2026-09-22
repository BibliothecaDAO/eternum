import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";

export const arenaModeRules =
  rule.HOME_REWARDS |
  rule.DISCOVER_CAMPS |
  rule.DISCOVER_CHESTS |
  rule.CAPTURE_VILLAGES |
  rule.SAME_OWNER_TRANSFER |
  rule.RESERVED_HYPERSTRUCTURES |
  rule.OWNER_ONLY_SHARES |
  rule.HYPERSTRUCTURE_MULTIPLIERS |
  rule.PRODUCTION_START;

export function commandMask(disabled: Array<keyof typeof nativeCommandBits>): bigint {
  let mask = Object.values(nativeCommandBits).reduce((mask, bit) => mask | BigInt(bit), 0n);
  for (const command of disabled) mask &= ~BigInt(nativeCommandBits[command]);
  return mask;
}

export const arenaCommandMask = commandMask([
  "TransferStructureOwnership",
  "TransferStructureResourcesToExplorer",
  "BurnLaborForResourceProduction",
  "CreateTradeOrder",
  "AcceptTradeOrder",
  "CancelTradeOrder",
  "CreateBanks",
  "BuyFromBank",
  "SellToBank",
  "AddBankLiquidity",
  "RemoveBankLiquidity",
  "PledgeFaith",
  "RemoveFaith",
  "UpdateWonderOwnership",
  "UpdateFaithfulOwnership",
  "ClaimWonderPoints",
  "ClaimPlayerFaithPoints",
  "Raid",
  "EnterDepth",
  "BuyRealmUpgrade",
]);
