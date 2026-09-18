use core::poseidon::poseidon_hash_span;
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateExplorer {
    pub structure_id: u32,
    pub category: u8,
    pub tier: u8,
    pub amount: u128,
    pub direction: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Explore {
    pub explorer_id: u32,
    pub direction: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Battle {
    pub attacker_id: u32,
    pub defender_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Move {
    pub explorer_id: u32,
    pub directions: Span<u8>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ToggleAlternate {
    pub explorer_id: u32,
    pub spire_direction: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Command {
    CreateExplorer: CreateExplorer,
    Explore: Explore,
    ClaimProduction: u32,
    Battle: crate::combat_actions::AttackExplorer,
    Move: Move,
    ToggleAlternate: ToggleAlternate,
    TransferStructureOwnership: crate::ownership::TransferOwnership,
    SetAddressName: crate::names::SetAddressName,
    LevelUp: u32,
    ReserveHyperstructures: u8,
    SettleBlitz: crate::settlement::SettleBlitz,
    ProvisionRealm: u32,
    CreateReservedHyperstructure: crate::troops::Coord,
    SettleSeason: crate::realms::SettleSeason,
    SettleVillage: crate::village::SettleVillage,
    ReceiveVillageArmy: u32,
    ApproveResources: crate::resources::ResourceApproval,
    BurnStructureResources: crate::resources::ResourceBurn,
    RegularizeResourceWeights: Span<u32>,
    BurnExplorerResources: crate::resources::ResourceBurn,
    TransferExplorerResources: crate::resources::ResourceTransfer,
    TransferStructureResourcesToExplorer: crate::resources::ResourceTransfer,
    OffloadArrival: crate::arrivals::OffloadArrival,
    SendResources: crate::resources::ResourceTransfer,
    PickupResources: crate::resources::ResourceTransfer,
    TransferExplorerResourcesToStructure: crate::resources::ResourceTransfer,
    BurnResourceForLaborProduction: crate::production::RefillProduction,
    BurnLaborForResourceProduction: crate::production::RefillProduction,
    BurnResourceForResourceProduction: crate::production::RefillProduction,
    CreateBuilding: crate::buildings::CreateBuilding,
    DestroyBuilding: crate::buildings::ChangeBuilding,
    PauseBuildingProduction: crate::buildings::ChangeBuilding,
    ResumeBuildingProduction: crate::buildings::ChangeBuilding,
    ContributeBitcoinLabor: crate::bitcoin::ContributeLabor,
    CloseBitcoinPhase: u64,
    BindBitcoinPhase: u64,
    ClaimBitcoinPhase: crate::bitcoin::ClaimPhase,
    BattleGuard: Battle,
    CreateTradeOrder: crate::trade::CreateOrder,
    AcceptTradeOrder: crate::trade::AcceptOrder,
    CancelTradeOrder: u32,
    CreateBanks: Span<crate::market::BankPlacement>,
    BuyFromBank: crate::market::Swap,
    SellToBank: crate::market::Swap,
    AddBankLiquidity: crate::market::AddLiquidity,
    RemoveBankLiquidity: crate::market::RemoveLiquidity,
    InitializeHyperstructure: u32,
    ContributeHyperstructure: crate::hyperstructures::Contribution,
    AllocateHyperstructureShares: crate::hyperstructures::AllocateShares,
    SetConstructionAccess: crate::hyperstructures::SetConstructionAccess,
    OpenRelicChest: crate::relics::OpenChest,
    ApplyRelic: crate::relics::ApplyRelic,
    ExtractExplorationReward: u32,
    CloseSeason,
    PledgeFaith: crate::faith::Pledge,
    RemoveFaith: u32,
    UpdateWonderOwnership: u32,
    UpdateFaithfulOwnership: u32,
    ClaimWonderPoints: u32,
    ClaimPlayerFaithPoints: crate::faith::ClaimPlayer,
    SetFaithBlacklist: crate::faith::SetBlacklist,
    FundFaithPrizes: u128,
    DistributeFaithPrizes,
    ClaimFaithPrize: crate::faith::ClaimPlayer,
    AllocateGameChests,
    RankPlayers: crate::blitz_prizes::RankPlayers,
    ResetRanking,
    CraftRelic: u32,
    CreateGuild: crate::guilds::CreateGuild,
    JoinGuild: crate::guilds::JoinGuild,
    LeaveGuild,
    SetGuildWhitelist: crate::guilds::SetWhitelist,
    RemoveGuildMember: ContractAddress,
    MintDevelopmentResources: crate::dev::MintResources,
    MarkGameSettled,
    ManageTroops: crate::troop_management::ManageTroops,
    GuardAttack: crate::combat_actions::GuardAttack,
    Raid: crate::combat_actions::Raid,
    DepositResource: crate::bridge::Deposit,
    WithdrawResource: crate::bridge::Withdraw,
    ProvisionAndUpgradeRealm: u32,
    SetEntityName: crate::names::SetEntityName,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExecutionContext {
    pub raw_root: u256,
    pub timestamp: u64,
}

// Cairo Serde encodes the variant index followed by its typed fields.
pub fn command_commitment(command: Command) -> felt252 {
    let mut fields = array!['ETERNUM_COMMAND', 1];
    command.serialize(ref fields);
    poseidon_hash_span(fields.span())
}

pub const MAX_COMMAND_ITEMS: u32 = 64;

pub fn decode_command(arguments: Span<felt252>, commitment: felt252) -> Result<Command, Array<felt252>> {
    if arguments.len() > 256 {
        return Err(array!['command arguments limit']);
    }
    let mut fields = arguments;
    let command: Command = Serde::deserialize(ref fields).ok_or(array!['malformed command'])?;
    if !fields.is_empty() {
        return Err(array!['trailing command arguments']);
    }
    if command_commitment(command) != commitment {
        return Err(array!['command commitment mismatch']);
    }
    if command_items(command) > MAX_COMMAND_ITEMS {
        return Err(array!['command items limit']);
    }
    Ok(command)
}

fn command_items(command: Command) -> u32 {
    match command {
        Command::Move(value) => value.directions.len(),
        Command::Battle(value) => value.steal_resources.len(),
        Command::Raid(value) => value.steal_resources.len(),
        Command::SettleBlitz(value) => value.cosmetics.len(),
        Command::ApproveResources(value) => value.resources.len(),
        Command::BurnStructureResources(value) => value.resources.len(),
        Command::BurnExplorerResources(value) => value.resources.len(),
        Command::TransferExplorerResources(value) => value.resources.len(),
        Command::TransferStructureResourcesToExplorer(value) => value.resources.len(),
        Command::SendResources(value) => value.resources.len(),
        Command::PickupResources(value) => value.resources.len(),
        Command::TransferExplorerResourcesToStructure(value) => value.resources.len(),
        Command::ClaimBitcoinPhase(value) => value.mine_ids.len(),
        Command::ContributeHyperstructure(value) => value.resources.len(),
        Command::AllocateHyperstructureShares(value) => value.shareholders.len(),
        Command::RankPlayers(value) => value.players.len(),
        Command::MintDevelopmentResources(value) => value.resources.len(),
        Command::RegularizeResourceWeights(value) => value.len(),
        Command::CreateBanks(value) => value.len(),
        _ => 0,
    }
}

#[inline(never)]
pub fn assert_unique_entity_ids(ids: Span<u32>) {
    let mut seen: core::dict::Felt252Dict<u128> = Default::default();
    for id in ids {
        let key = (*id).into();
        assert!(seen.get(key) == 0, "duplicate entity id");
        seen.insert(key, 1);
    }
}

#[starknet::interface]
pub trait ITroopCommands<T> {
    fn create_explorer(
        ref self: T, game_id: u32, actor: ContractAddress, command: CreateExplorer, context: ExecutionContext,
    );
    fn explore(ref self: T, game_id: u32, actor: ContractAddress, command: Explore, context: ExecutionContext);
    fn battle(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::combat_actions::AttackExplorer,
        context: ExecutionContext,
    );
}

#[starknet::interface]
pub trait IResourceCommands<T> {
    fn send_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: ExecutionContext,
    );
    fn pickup_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: ExecutionContext,
    );
    fn transfer_explorer_resources_to_structure(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: ExecutionContext,
    );
    fn offload_arrival(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::arrivals::OffloadArrival,
        context: ExecutionContext,
    );
    fn claim_production(
        ref self: T, game_id: u32, actor: ContractAddress, structure_id: u32, context: ExecutionContext,
    );
    fn approve_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceApproval,
        context: ExecutionContext,
    );
    fn burn_structure_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceBurn,
        context: ExecutionContext,
    );
    fn burn_explorer_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceBurn,
        context: ExecutionContext,
    );
    fn transfer_explorer_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: ExecutionContext,
    );
    fn transfer_structure_resources_to_explorer(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: ExecutionContext,
    );
    fn regularize_resource_weights(
        ref self: T, game_id: u32, actor: ContractAddress, structure_ids: Span<u32>, context: ExecutionContext,
    );
}

#[starknet::interface]
pub trait ITravelCommands<T> {
    fn move_explorer(ref self: T, game_id: u32, actor: ContractAddress, command: Move, context: ExecutionContext);
    fn toggle_alternate(
        ref self: T, game_id: u32, actor: ContractAddress, command: ToggleAlternate, context: ExecutionContext,
    );
}

pub fn assert_context_time(timestamp: u64) {
    assert!(
        eternum_randomness_protocol::entrypoint::timestamp_in_bounds(timestamp, starknet::get_block_timestamp()),
        "execution timestamp is in the future",
    );
}
