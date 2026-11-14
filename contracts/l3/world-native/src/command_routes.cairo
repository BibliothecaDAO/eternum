// Generated from schema/command-routes.mjs and production logic ABIs.
use starknet::storage::StoragePointerReadAccess;

#[derive(Copy, Drop)]
pub struct CommandRoute {
    pub logic: u8,
    pub selector: felt252,
    pub items_offset: Option<u32>,
    pub batch: bool,
}

pub const SETTLE_BLITZ_ROSTER: u32 = 7;

pub const COMMAND_IDS: [u32; 53] = [
    72, 0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 38, 39, 40,
    41, 42, 43, 44, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 62, 63, 64, 65, 66, 67, 68, 69,
];
pub const COMMAND_ROUTES: [Option<CommandRoute>; 73] = [
    Some(CommandRoute { logic: 6, selector: selector!("create_explorer"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 16, selector: selector!("explore"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 12, selector: selector!("battle"), items_offset: Some(2), batch: false }),
    Some(CommandRoute { logic: 16, selector: selector!("move_explorer"), items_offset: Some(1), batch: false }),
    Some(CommandRoute { logic: 16, selector: selector!("toggle_alternate"), items_offset: None, batch: false }), None,
    Some(CommandRoute { logic: 3, selector: selector!("level_up"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 7, selector: selector!("settle_blitz_roster"), items_offset: None, batch: true }),
    Some(CommandRoute { logic: 5, selector: selector!("activate_realm_economy"), items_offset: None, batch: false }),
    Some(
        CommandRoute {
            logic: 5, selector: selector!("create_reserved_hyperstructure"), items_offset: None, batch: false,
        },
    ),
    Some(CommandRoute { logic: 7, selector: selector!("settle_season"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 0, selector: selector!("settle_village"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 5, selector: selector!("receive_village_army"), items_offset: None, batch: false }),
    Some(
        CommandRoute { logic: 4, selector: selector!("burn_structure_resources"), items_offset: Some(1), batch: false },
    ),
    Some(
        CommandRoute {
            logic: 4, selector: selector!("transfer_explorer_resources"), items_offset: Some(2), batch: false,
        },
    ),
    None, Some(CommandRoute { logic: 4, selector: selector!("offload_arrival"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 4, selector: selector!("send_resources"), items_offset: Some(2), batch: false }),
    Some(
        CommandRoute {
            logic: 4,
            selector: selector!("transfer_explorer_resources_to_structure"),
            items_offset: Some(2),
            batch: false,
        },
    ),
    None,
    Some(
        CommandRoute {
            logic: 4, selector: selector!("burn_resource_for_resource_production"), items_offset: None, batch: false,
        },
    ),
    Some(CommandRoute { logic: 3, selector: selector!("create_building"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 3, selector: selector!("destroy_building"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 3, selector: selector!("pause_building_production"), items_offset: None, batch: false }),
    Some(
        CommandRoute { logic: 3, selector: selector!("resume_building_production"), items_offset: None, batch: false },
    ),
    Some(CommandRoute { logic: 0, selector: selector!("contribute_bitcoin_labor"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 0, selector: selector!("close_bitcoin_phase"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 0, selector: selector!("bind_bitcoin_phase"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 0, selector: selector!("claim_bitcoin_phase"), items_offset: Some(1), batch: true }),
    Some(CommandRoute { logic: 12, selector: selector!("battle_guard"), items_offset: None, batch: false }), None, None,
    None, None, None, None, None, None,
    Some(CommandRoute { logic: 9, selector: selector!("initialize_hyperstructure"), items_offset: None, batch: false }),
    Some(
        CommandRoute {
            logic: 9, selector: selector!("contribute_hyperstructure"), items_offset: Some(2), batch: false,
        },
    ),
    Some(
        CommandRoute {
            logic: 9, selector: selector!("allocate_hyperstructure_shares"), items_offset: Some(1), batch: false,
        },
    ),
    Some(CommandRoute { logic: 9, selector: selector!("set_construction_access"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 15, selector: selector!("open_relic_chest"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 15, selector: selector!("apply_relic"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 0, selector: selector!("close_season"), items_offset: None, batch: true }), None, None,
    None, None, None, None,
    Some(CommandRoute { logic: 10, selector: selector!("record_blitz_results"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 5, selector: selector!("craft_relic"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 14, selector: selector!("create_guild"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 14, selector: selector!("join_guild"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 14, selector: selector!("leave_guild"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 14, selector: selector!("set_guild_whitelist"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 14, selector: selector!("remove_guild_member"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 0, selector: selector!("mark_game_settled"), items_offset: None, batch: true }),
    Some(CommandRoute { logic: 6, selector: selector!("manage_troops"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 12, selector: selector!("guard_attack"), items_offset: None, batch: false }), None,
    Some(CommandRoute { logic: 4, selector: selector!("deposit_resource"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 4, selector: selector!("withdraw_resource"), items_offset: None, batch: false }),
    Some(
        CommandRoute { logic: 5, selector: selector!("provision_and_upgrade_realm"), items_offset: None, batch: false },
    ),
    Some(CommandRoute { logic: 5, selector: selector!("set_entity_name"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 16, selector: selector!("enter_depth"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 3, selector: selector!("research"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 15, selector: selector!("spend_skill_point"), items_offset: None, batch: false }),
    Some(CommandRoute { logic: 16, selector: selector!("interact_site"), items_offset: None, batch: false }), None,
    None, Some(CommandRoute { logic: 14, selector: selector!("claim_daily_quest"), items_offset: None, batch: false }),
];

pub fn logic_class(
    classes: starknet::storage::StoragePointer<games_storage::release::LogicClasses>, index: u8,
) -> starknet::ClassHash {
    match index {
        0 => classes.season.read(),
        1 => classes.map.read(),
        2 => classes.placement.read(),
        3 => classes.construction.read(),
        4 => classes.production.read(),
        5 => classes.structures.read(),
        6 => classes.troops.read(),
        7 => classes.settlement.read(),
        8 => classes.resources.read(),
        9 => classes.economy.read(),
        10 => classes.prizes.read(),
        11 => classes.registry.read(),
        12 => classes.combat.read(),
        13 => classes.raid.read(),
        14 => classes.bridge.read(),
        15 => classes.relics.read(),
        16 => classes.movement.read(),
        _ => panic!("unknown command logic"),
    }
}

// Decode the complete command before reading a roll; routes retain the same wire discriminants.
#[derive(Copy, Drop, Debug, PartialEq)]
pub enum Command {
    ClaimDailyQuest: crate::quests::ClaimDailyQuest,
    CreateExplorer: crate::commands::CreateExplorer,
    Explore: crate::commands::Explore,
    Battle: crate::combat_actions::AttackExplorer,
    Move: crate::commands::Move,
    ToggleAlternate: crate::commands::ToggleAlternate,
    LevelUp: core::integer::u64,
    SettleBlitzRoster,
    ProvisionRealm: core::integer::u64,
    CreateReservedHyperstructure: crate::troops::Coord,
    SettleSeason: crate::realms::SettleSeason,
    SettleVillage: crate::village::SettleVillage,
    ReceiveVillageArmy: core::integer::u64,
    BurnStructureResources: crate::resources::ResourceBurn,
    TransferExplorerResources: crate::resources::ResourceTransfer,
    OffloadArrival: crate::arrivals::OffloadArrival,
    SendResources: crate::resources::ResourceTransfer,
    TransferExplorerResourcesToStructure: crate::resources::ResourceTransfer,
    BurnResourceForResourceProduction: crate::production::RefillProduction,
    CreateBuilding: crate::buildings::CreateBuilding,
    DestroyBuilding: crate::buildings::ChangeBuilding,
    PauseBuildingProduction: crate::buildings::ChangeBuilding,
    ResumeBuildingProduction: crate::buildings::ChangeBuilding,
    ContributeBitcoinLabor: crate::bitcoin::ContributeLabor,
    CloseBitcoinPhase: core::integer::u64,
    BindBitcoinPhase: core::integer::u64,
    ClaimBitcoinPhase: crate::bitcoin::ClaimPhase,
    BattleGuard: crate::commands::Battle,
    InitializeHyperstructure: core::integer::u64,
    ContributeHyperstructure: crate::hyperstructures::Contribution,
    AllocateHyperstructureShares: crate::hyperstructures::AllocateShares,
    SetConstructionAccess: crate::hyperstructures::SetConstructionAccess,
    OpenRelicChest: crate::relics::OpenChest,
    ApplyRelic: crate::relics::ApplyRelic,
    CloseSeason,
    RecordBlitzResults,
    CraftRelic: core::integer::u64,
    CreateGuild: crate::guilds::CreateGuild,
    JoinGuild: crate::guilds::JoinGuild,
    LeaveGuild,
    SetGuildWhitelist: crate::guilds::SetWhitelist,
    RemoveGuildMember: starknet::contract_address::ContractAddress,
    MarkGameSettled,
    ManageTroops: crate::troop_management::ManageTroops,
    GuardAttack: crate::combat_actions::GuardAttack,
    DepositResource: crate::bridge::Deposit,
    WithdrawResource: crate::bridge::Withdraw,
    ProvisionAndUpgradeRealm: core::integer::u64,
    SetEntityName: crate::names::SetEntityName,
    EnterDepth: crate::commands::EnterDepth,
    Research: crate::research::Research,
    SpendSkillPoint: crate::progression::SpendSkillPoint,
    InteractSite: crate::relics::InteractSite,
}

pub impl CommandSerde of Serde<Command> {
    fn serialize(self: @Command, ref output: Array<felt252>) {
        match self {
            Command::ClaimDailyQuest(value) => {
                output.append(72);
                Serde::serialize(value, ref output);
            },
            Command::CreateExplorer(value) => {
                output.append(0);
                Serde::serialize(value, ref output);
            },
            Command::Explore(value) => {
                output.append(1);
                Serde::serialize(value, ref output);
            },
            Command::Battle(value) => {
                output.append(2);
                Serde::serialize(value, ref output);
            },
            Command::Move(value) => {
                output.append(3);
                Serde::serialize(value, ref output);
            },
            Command::ToggleAlternate(value) => {
                output.append(4);
                Serde::serialize(value, ref output);
            },
            Command::LevelUp(value) => {
                output.append(6);
                Serde::serialize(value, ref output);
            },
            Command::SettleBlitzRoster(_) => { output.append(7); },
            Command::ProvisionRealm(value) => {
                output.append(8);
                Serde::serialize(value, ref output);
            },
            Command::CreateReservedHyperstructure(value) => {
                output.append(9);
                Serde::serialize(value, ref output);
            },
            Command::SettleSeason(value) => {
                output.append(10);
                Serde::serialize(value, ref output);
            },
            Command::SettleVillage(value) => {
                output.append(11);
                Serde::serialize(value, ref output);
            },
            Command::ReceiveVillageArmy(value) => {
                output.append(12);
                Serde::serialize(value, ref output);
            },
            Command::BurnStructureResources(value) => {
                output.append(13);
                Serde::serialize(value, ref output);
            },
            Command::TransferExplorerResources(value) => {
                output.append(14);
                Serde::serialize(value, ref output);
            },
            Command::OffloadArrival(value) => {
                output.append(16);
                Serde::serialize(value, ref output);
            },
            Command::SendResources(value) => {
                output.append(17);
                Serde::serialize(value, ref output);
            },
            Command::TransferExplorerResourcesToStructure(value) => {
                output.append(18);
                Serde::serialize(value, ref output);
            },
            Command::BurnResourceForResourceProduction(value) => {
                output.append(20);
                Serde::serialize(value, ref output);
            },
            Command::CreateBuilding(value) => {
                output.append(21);
                Serde::serialize(value, ref output);
            },
            Command::DestroyBuilding(value) => {
                output.append(22);
                Serde::serialize(value, ref output);
            },
            Command::PauseBuildingProduction(value) => {
                output.append(23);
                Serde::serialize(value, ref output);
            },
            Command::ResumeBuildingProduction(value) => {
                output.append(24);
                Serde::serialize(value, ref output);
            },
            Command::ContributeBitcoinLabor(value) => {
                output.append(25);
                Serde::serialize(value, ref output);
            },
            Command::CloseBitcoinPhase(value) => {
                output.append(26);
                Serde::serialize(value, ref output);
            },
            Command::BindBitcoinPhase(value) => {
                output.append(27);
                Serde::serialize(value, ref output);
            },
            Command::ClaimBitcoinPhase(value) => {
                output.append(28);
                Serde::serialize(value, ref output);
            },
            Command::BattleGuard(value) => {
                output.append(29);
                Serde::serialize(value, ref output);
            },
            Command::InitializeHyperstructure(value) => {
                output.append(38);
                Serde::serialize(value, ref output);
            },
            Command::ContributeHyperstructure(value) => {
                output.append(39);
                Serde::serialize(value, ref output);
            },
            Command::AllocateHyperstructureShares(value) => {
                output.append(40);
                Serde::serialize(value, ref output);
            },
            Command::SetConstructionAccess(value) => {
                output.append(41);
                Serde::serialize(value, ref output);
            },
            Command::OpenRelicChest(value) => {
                output.append(42);
                Serde::serialize(value, ref output);
            },
            Command::ApplyRelic(value) => {
                output.append(43);
                Serde::serialize(value, ref output);
            },
            Command::CloseSeason(_) => { output.append(44); },
            Command::RecordBlitzResults(_) => { output.append(51); },
            Command::CraftRelic(value) => {
                output.append(52);
                Serde::serialize(value, ref output);
            },
            Command::CreateGuild(value) => {
                output.append(53);
                Serde::serialize(value, ref output);
            },
            Command::JoinGuild(value) => {
                output.append(54);
                Serde::serialize(value, ref output);
            },
            Command::LeaveGuild(_) => { output.append(55); },
            Command::SetGuildWhitelist(value) => {
                output.append(56);
                Serde::serialize(value, ref output);
            },
            Command::RemoveGuildMember(value) => {
                output.append(57);
                Serde::serialize(value, ref output);
            },
            Command::MarkGameSettled(_) => { output.append(58); },
            Command::ManageTroops(value) => {
                output.append(59);
                Serde::serialize(value, ref output);
            },
            Command::GuardAttack(value) => {
                output.append(60);
                Serde::serialize(value, ref output);
            },
            Command::DepositResource(value) => {
                output.append(62);
                Serde::serialize(value, ref output);
            },
            Command::WithdrawResource(value) => {
                output.append(63);
                Serde::serialize(value, ref output);
            },
            Command::ProvisionAndUpgradeRealm(value) => {
                output.append(64);
                Serde::serialize(value, ref output);
            },
            Command::SetEntityName(value) => {
                output.append(65);
                Serde::serialize(value, ref output);
            },
            Command::EnterDepth(value) => {
                output.append(66);
                Serde::serialize(value, ref output);
            },
            Command::Research(value) => {
                output.append(67);
                Serde::serialize(value, ref output);
            },
            Command::SpendSkillPoint(value) => {
                output.append(68);
                Serde::serialize(value, ref output);
            },
            Command::InteractSite(value) => {
                output.append(69);
                Serde::serialize(value, ref output);
            },
        }
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<Command> {
        let tag: u32 = Serde::deserialize(ref serialized)?;
        match tag {
            0 => Some(Command::CreateExplorer(Serde::deserialize(ref serialized)?)),
            1 => Some(Command::Explore(Serde::deserialize(ref serialized)?)),
            2 => Some(Command::Battle(Serde::deserialize(ref serialized)?)),
            3 => Some(Command::Move(Serde::deserialize(ref serialized)?)),
            4 => Some(Command::ToggleAlternate(Serde::deserialize(ref serialized)?)),
            5 => None,
            6 => Some(Command::LevelUp(Serde::deserialize(ref serialized)?)),
            7 => Some(Command::SettleBlitzRoster(())),
            8 => Some(Command::ProvisionRealm(Serde::deserialize(ref serialized)?)),
            9 => Some(Command::CreateReservedHyperstructure(Serde::deserialize(ref serialized)?)),
            10 => Some(Command::SettleSeason(Serde::deserialize(ref serialized)?)),
            11 => Some(Command::SettleVillage(Serde::deserialize(ref serialized)?)),
            12 => Some(Command::ReceiveVillageArmy(Serde::deserialize(ref serialized)?)),
            13 => Some(Command::BurnStructureResources(Serde::deserialize(ref serialized)?)),
            14 => Some(Command::TransferExplorerResources(Serde::deserialize(ref serialized)?)),
            15 => None,
            16 => Some(Command::OffloadArrival(Serde::deserialize(ref serialized)?)),
            17 => Some(Command::SendResources(Serde::deserialize(ref serialized)?)),
            18 => Some(Command::TransferExplorerResourcesToStructure(Serde::deserialize(ref serialized)?)),
            19 => None,
            20 => Some(Command::BurnResourceForResourceProduction(Serde::deserialize(ref serialized)?)),
            21 => Some(Command::CreateBuilding(Serde::deserialize(ref serialized)?)),
            22 => Some(Command::DestroyBuilding(Serde::deserialize(ref serialized)?)),
            23 => Some(Command::PauseBuildingProduction(Serde::deserialize(ref serialized)?)),
            24 => Some(Command::ResumeBuildingProduction(Serde::deserialize(ref serialized)?)),
            25 => Some(Command::ContributeBitcoinLabor(Serde::deserialize(ref serialized)?)),
            26 => Some(Command::CloseBitcoinPhase(Serde::deserialize(ref serialized)?)),
            27 => Some(Command::BindBitcoinPhase(Serde::deserialize(ref serialized)?)),
            28 => Some(Command::ClaimBitcoinPhase(Serde::deserialize(ref serialized)?)),
            29 => Some(Command::BattleGuard(Serde::deserialize(ref serialized)?)),
            30 => None,
            31 => None,
            32 => None,
            33 => None,
            34 => None,
            35 => None,
            36 => None,
            37 => None,
            38 => Some(Command::InitializeHyperstructure(Serde::deserialize(ref serialized)?)),
            39 => Some(Command::ContributeHyperstructure(Serde::deserialize(ref serialized)?)),
            40 => Some(Command::AllocateHyperstructureShares(Serde::deserialize(ref serialized)?)),
            41 => Some(Command::SetConstructionAccess(Serde::deserialize(ref serialized)?)),
            42 => Some(Command::OpenRelicChest(Serde::deserialize(ref serialized)?)),
            43 => Some(Command::ApplyRelic(Serde::deserialize(ref serialized)?)),
            44 => Some(Command::CloseSeason(())),
            45 => None,
            46 => None,
            47 => None,
            48 => None,
            49 => None,
            50 => None,
            51 => Some(Command::RecordBlitzResults(())),
            52 => Some(Command::CraftRelic(Serde::deserialize(ref serialized)?)),
            53 => Some(Command::CreateGuild(Serde::deserialize(ref serialized)?)),
            54 => Some(Command::JoinGuild(Serde::deserialize(ref serialized)?)),
            55 => Some(Command::LeaveGuild(())),
            56 => Some(Command::SetGuildWhitelist(Serde::deserialize(ref serialized)?)),
            57 => Some(Command::RemoveGuildMember(Serde::deserialize(ref serialized)?)),
            58 => Some(Command::MarkGameSettled(())),
            59 => Some(Command::ManageTroops(Serde::deserialize(ref serialized)?)),
            60 => Some(Command::GuardAttack(Serde::deserialize(ref serialized)?)),
            61 => None,
            62 => Some(Command::DepositResource(Serde::deserialize(ref serialized)?)),
            63 => Some(Command::WithdrawResource(Serde::deserialize(ref serialized)?)),
            64 => Some(Command::ProvisionAndUpgradeRealm(Serde::deserialize(ref serialized)?)),
            65 => Some(Command::SetEntityName(Serde::deserialize(ref serialized)?)),
            66 => Some(Command::EnterDepth(Serde::deserialize(ref serialized)?)),
            67 => Some(Command::Research(Serde::deserialize(ref serialized)?)),
            68 => Some(Command::SpendSkillPoint(Serde::deserialize(ref serialized)?)),
            69 => Some(Command::InteractSite(Serde::deserialize(ref serialized)?)),
            70 => None,
            71 => None,
            72 => Some(Command::ClaimDailyQuest(Serde::deserialize(ref serialized)?)),
            _ => None,
        }
    }
}
