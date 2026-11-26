import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/balance.gen";
import {
  nativeBlitzCommandBits,
  nativeCommandBits,
  nativeFrontierOnlyCommandBits,
} from "../../../contracts/l3/world-native/schema/commands.gen";

export const arenaModeRules =
  rule.HOME_REWARDS | rule.DISCOVER_CAMPS | rule.CAPTURE_VILLAGES | rule.SAME_OWNER_TRANSFER | rule.PRODUCTION_START;

type NativeCommand = keyof typeof nativeCommandBits;

function commandBits(commands: NativeCommand[]): bigint {
  return commands.reduce((mask, command) => mask | BigInt(nativeCommandBits[command]), 0n);
}

const arenaCommands = (Object.keys(nativeCommandBits) as NativeCommand[]).filter(
  (command) => !Object.hasOwn(nativeFrontierOnlyCommandBits, command),
);
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
  "MarkGameSettled",
];

const blitzOnlyCommandMask = Object.values(nativeBlitzCommandBits).reduce((mask, bit) => mask | BigInt(bit), 0n);

export const arenaCommandMask = (commandBits(arenaCommands) & ~commandBits(arenaClosedCommands)) | blitzOnlyCommandMask;

const blitzCommandsWithoutRoute = ["OpenRelicChest", "CraftRelic"];

const blitzPendingRoutedCommands = arenaCommands.filter(
  (command) => !arenaClosedCommands.includes(command) && !blitzReturnedCommands.includes(command),
);

export const blitzPendingCommands = [...blitzPendingRoutedCommands, ...blitzCommandsWithoutRoute];

export const blitzPendingCommandMask = commandBits(blitzPendingRoutedCommands);
