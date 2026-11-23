// Live routes define dispatch; permanent wire IDs live in wire-ids.json. Payload types come from production ABIs.
export const commandRoutes = [
  { name: "BuySeal", logic: "bridge", entrypoint: "buy_seal" },
  { name: "BuyStamina", logic: "relics", entrypoint: "buy_stamina" },
  { name: "ChooseOath", logic: "relics", entrypoint: "choose_oath" },
  { name: "RerollOath", logic: "relics", entrypoint: "reroll_oath" },
  { name: "ClaimDailyQuest", logic: "bridge", entrypoint: "claim_daily_quest" },
  {
    name: "CreateExplorer",
    logic: "troops",
    entrypoint: "create_explorer",
  },
  {
    name: "Explore",
    logic: "movement",
    entrypoint: "explore",
  },
  {
    name: "Battle",
    logic: "combat",
    entrypoint: "battle",
    items: "steal_resources",
  },
  {
    name: "Move",
    logic: "movement",
    entrypoint: "move_explorer",
    items: "directions",
  },
  {
    name: "ToggleAlternate",
    logic: "movement",
    entrypoint: "toggle_alternate",
  },
  {
    name: "LevelUp",
    logic: "construction",
    entrypoint: "level_up",
  },
  {
    name: "ProvisionRealm",
    logic: "structures",
    entrypoint: "activate_realm_economy",
  },
  {
    name: "SettleSeason",
    logic: "settlement",
    entrypoint: "settle_season",
  },
  {
    name: "SettleVillage",
    logic: "season",
    entrypoint: "settle_village",
  },
  {
    name: "ReceiveVillageArmy",
    logic: "structures",
    entrypoint: "receive_village_army",
  },
  {
    name: "BurnStructureResources",
    logic: "production",
    entrypoint: "burn_structure_resources",
    items: "resources",
  },
  {
    name: "TransferExplorerResources",
    logic: "production",
    entrypoint: "transfer_explorer_resources",
    items: "resources",
  },
  {
    name: "OffloadArrival",
    logic: "production",
    entrypoint: "offload_arrival",
  },
  {
    name: "SendResources",
    logic: "production",
    entrypoint: "send_resources",
    items: "resources",
  },
  {
    name: "TransferExplorerResourcesToStructure",
    logic: "production",
    entrypoint: "transfer_explorer_resources_to_structure",
    items: "resources",
  },
  {
    name: "BurnResourceForResourceProduction",
    logic: "production",
    entrypoint: "burn_resource_for_resource_production",
  },
  {
    name: "CreateBuilding",
    logic: "construction",
    entrypoint: "create_building",
  },
  {
    name: "DestroyBuilding",
    logic: "construction",
    entrypoint: "destroy_building",
  },
  {
    name: "PauseBuildingProduction",
    logic: "construction",
    entrypoint: "pause_building_production",
  },
  {
    name: "ResumeBuildingProduction",
    logic: "construction",
    entrypoint: "resume_building_production",
  },
  {
    name: "BattleGuard",
    logic: "combat",
    entrypoint: "battle_guard",
  },
  {
    name: "ApplyRelic",
    logic: "relics",
    entrypoint: "apply_relic",
  },
  {
    name: "CreateGuild",
    logic: "bridge",
    entrypoint: "create_guild",
  },
  {
    name: "JoinGuild",
    logic: "bridge",
    entrypoint: "join_guild",
  },
  {
    name: "LeaveGuild",
    logic: "bridge",
    entrypoint: "leave_guild",
  },
  {
    name: "SetGuildWhitelist",
    logic: "bridge",
    entrypoint: "set_guild_whitelist",
  },
  {
    name: "RemoveGuildMember",
    logic: "bridge",
    entrypoint: "remove_guild_member",
  },
  {
    name: "MarkGameSettled",
    logic: "season",
    entrypoint: "mark_game_settled",
    batch: true,
  },
  {
    name: "ManageTroops",
    logic: "troops",
    entrypoint: "manage_troops",
  },
  {
    name: "GuardAttack",
    logic: "combat",
    entrypoint: "guard_attack",
  },
  {
    name: "ProvisionAndUpgradeRealm",
    logic: "structures",
    entrypoint: "provision_and_upgrade_realm",
  },
  {
    name: "SetEntityName",
    logic: "structures",
    entrypoint: "set_entity_name",
  },
  {
    name: "EnterDepth",
    logic: "movement",
    entrypoint: "enter_depth",
  },
  {
    name: "Research",
    logic: "construction",
    entrypoint: "research",
  },
  {
    name: "InteractSite",
    logic: "movement",
    entrypoint: "interact_site",
  },
];

export const blitzCommandRoutes = [
  {
    name: "SeatBlitzRoster",
    logic: "settlement",
    entrypoint: "seat_blitz_roster",
    batch: true,
  },
  {
    name: "RaiseHyperstructure",
    logic: "structures",
    entrypoint: "raise_hyperstructure",
  },
];
