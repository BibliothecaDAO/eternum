import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/balance.gen";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";

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
];

export const arenaCommandMask = commandBits(allCommands) & ~commandBits(arenaClosedCommands);

export const blitzPendingCommands = allCommands.filter(
  (command) => !arenaClosedCommands.includes(command) && !blitzReturnedCommands.includes(command),
);

export const blitzPendingCommandMask = commandBits(blitzPendingCommands);
