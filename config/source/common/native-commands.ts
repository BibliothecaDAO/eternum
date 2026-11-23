import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/balance.gen";
import { nativeBlitzCommandBits, nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";

export const arenaModeRules =
  rule.HOME_REWARDS | rule.DISCOVER_CAMPS | rule.CAPTURE_VILLAGES | rule.SAME_OWNER_TRANSFER | rule.PRODUCTION_START;

type NativeCommand = keyof typeof nativeCommandBits;

function commandBits(commands: NativeCommand[]): bigint {
  return commands.reduce((mask, command) => mask | BigInt(nativeCommandBits[command]), 0n);
}

const allCommands = Object.keys(nativeCommandBits) as NativeCommand[];
const arenaClosedCommands: NativeCommand[] = [
  "EnterDepth",
  "Research",
  "InteractSite",
  "BuySeal",
  "BuyStamina",
  "ChooseOath",
  "RerollOath",
  "ClaimDailyQuest",
  "ProvisionRealm",
  "ProvisionAndUpgradeRealm",
  "SettleSeason",
  "ToggleAlternate",
];
const blitzReturnedCommands: NativeCommand[] = [
  "CreateBuilding",
  "DestroyBuilding",
  "PauseBuildingProduction",
  "ResumeBuildingProduction",
  "CreateExplorer",
  "ManageTroops",
  "Move",
  "CreateGuild",
  "JoinGuild",
  "LeaveGuild",
  "SetGuildWhitelist",
  "RemoveGuildMember",
  "SetEntityName",
  "LevelUp",
  "SendResources",
  "OffloadArrival",
  "BurnStructureResources",
  "TransferExplorerResources",
  "TransferExplorerResourcesToStructure",
  "BurnResourceForResourceProduction",
  "Explore",
  "BattleGuard",
  "Battle",
  "GuardAttack",
  "SettleVillage",
];

const blitzOnlyCommandMask = Object.values(nativeBlitzCommandBits).reduce((mask, bit) => mask | BigInt(bit), 0n);

export const arenaCommandMask = (commandBits(allCommands) & ~commandBits(arenaClosedCommands)) | blitzOnlyCommandMask;

const blitzCommandsWithoutRoute = [
  "CreateReservedHyperstructure",
  "AllocateHyperstructureShares",
  "OpenRelicChest",
  "RecordBlitzResults",
  "CraftRelic",
];

const blitzPendingRoutedCommands = allCommands.filter(
  (command) => !arenaClosedCommands.includes(command) && !blitzReturnedCommands.includes(command),
);

export const blitzPendingCommands = [...blitzPendingRoutedCommands, ...blitzCommandsWithoutRoute];

export const blitzPendingCommandMask = commandBits(blitzPendingRoutedCommands);
