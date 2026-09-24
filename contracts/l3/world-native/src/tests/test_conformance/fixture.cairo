use eternum_randomness_protocol::epochs::{
    IRandomnessEpochsDispatcher, IRandomnessEpochsDispatcherTrait, epoch_commitment,
};
use world_native::hyperstructures::{IHyperstructuresDispatcher, IHyperstructuresDispatcherTrait};
use world_native::resources::{IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceRule};
use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
use super::receipts::RecordedReceiptsTrait;
mod settlement;
use eternum_randomness_protocol::authority::{
    ISequencingAccountSafeDispatcher, ISequencingAccountSafeDispatcherTrait, ISequencingAuthorityDispatcher,
    ISequencingAuthorityDispatcherTrait,
};
use eternum_randomness_protocol::entrypoint::{
    ExecutionContext, IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait,
};
use eternum_randomness_protocol::{Envelope, Intent, action_identity, encode_envelope};
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_account_contract_address,
    start_cheat_block_timestamp_global, start_cheat_caller_address, start_cheat_chain_id_global,
    start_cheat_resource_bounds, start_cheat_signature, start_cheat_transaction_hash, start_cheat_transaction_version,
    stop_cheat_caller_address,
};
use starknet::account::Call;
use starknet::{ContractAddress, ResourcesBounds, SyscallResultTrait};
use world_native::commands::{
    Command, CreateExplorer, Explore, ICreateExplorerDispatcher, ICreateExplorerDispatcherTrait, IExploreSafeDispatcher,
    IExploreSafeDispatcherTrait, command_commitment,
};
use world_native::game::{GameRegistry, IPointsDispatcher, IPointsDispatcherTrait};
use world_native::games::{IGamesAuthenticationDispatcher, IGamesAuthenticationDispatcherTrait};
use world_native::structures::{IStructureOperationsDispatcher, IStructureOperationsDispatcherTrait};
use world_native::troops::Coord;

#[derive(Copy, Drop)]
pub struct IRecordedExecutionDispatcher {
    pub contract_address: ContractAddress,
}
#[derive(Copy, Drop)]
pub struct IRecordedExecutionSafeDispatcher {
    pub contract_address: ContractAddress,
}
#[generate_trait]
pub impl RecordedDispatcher of IRecordedExecutionDispatcherTrait {
    fn execute(
        self: IRecordedExecutionDispatcher, intent: Intent, context: ExecutionContext, signature: Span<felt252>,
    ) {
        submit(self.contract_address, selector!("execute"), intent, context, signature).unwrap_syscall();
    }
}
#[generate_trait]
pub impl RecordedSafeDispatcher of IRecordedExecutionSafeDispatcherTrait {
    fn execute(
        self: IRecordedExecutionSafeDispatcher, intent: Intent, context: ExecutionContext, signature: Span<felt252>,
    ) -> Result<(), Array<felt252>> {
        submit(self.contract_address, selector!("execute"), intent, context, signature)
    }
}
#[feature("safe_dispatcher")]
fn submit(
    season: ContractAddress, entrypoint: felt252, intent: Intent, context: ExecutionContext, signature: Span<felt252>,
) -> Result<(), Array<felt252>> {
    // Route through the actual authority account so callbacks from gameplay domains keep their caller.
    let account = IGamesAuthenticationDispatcher { contract_address: season }.authentication().submitter;
    let public_key = ISequencingAuthorityDispatcher { contract_address: account }.get_public_key();
    let original: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    let key = if public_key == original.public_key {
        54321
    } else {
        67890
    };
    let hash = if public_key == original.public_key {
        999
    } else {
        1000
    };
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(key);
    let (authority_r, authority_s) = signer.sign(hash).unwrap();
    snforge_std::cheat_caller_address(account, 0.try_into().unwrap(), snforge_std::CheatSpan::TargetCalls(1));
    start_cheat_account_contract_address(account, account);
    start_cheat_transaction_version(account, 3);
    start_cheat_transaction_hash(account, hash);
    start_cheat_signature(account, array![authority_r, authority_s].span());
    let mut calldata = array![];
    intent.serialize(ref calldata);
    context.serialize(ref calldata);
    signature.serialize(ref calldata);
    ISequencingAccountSafeDispatcher { contract_address: account }
        .__execute__(array![Call { to: season, selector: entrypoint, calldata: calldata.span() }])
        .map(|_results| ())
}

pub fn actor() -> felt252 {
    crate::tests::player_address(456).into()
}

pub fn pair() -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(12345)
}
/// The actor's device signature: `[device_key, r, s]` under the fixture account's key.
pub fn signed(r: felt252, s: felt252) -> Span<felt252> {
    array![pair().public_key, r, s].span()
}
fn deploy(name: ByteArray, args: @Array<felt252>) -> ContractAddress {
    let (address, _) = declare(name).unwrap().contract_class().deploy(args).unwrap();
    address
}
pub fn setup() -> ContractAddress {
    // Reuse only an untouched fixture within one test; rejected calls must leave it unchanged.
    // Reprovisioning all resource rows ten times exceeds the test VM's event limit.
    let cached = *snforge_std::load(snforge_std::test_address(), selector!("conformance_fixture"), 1).at(0);
    if cached != 0 {
        let season: ContractAddress = cached.try_into().unwrap();
        // Untouched means no recorded action in any game the fixture hosts, including settlement's game 8.
        let heads = IRecordedExecutionViewsDispatcher { contract_address: season };
        if heads.get_head(7).order == 0 && heads.get_head(8).order == 0 && heads.get_head(9).order == 0 {
            configure_execution(season);
            return season;
        }
    }
    start_cheat_block_timestamp_global(900);
    start_cheat_chain_id_global('TEST');
    let administrator: ContractAddress = 222.try_into().unwrap();
    let (actor, player_class) = crate::tests::deploy_player(456, crate::tests::GUARDIAN);
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    let account = deploy("SequencingAccount", @array![administrator.into(), signer.public_key]);
    let classes = games_storage::release::LogicClasses {
        season: *declare("SeasonLogic").unwrap().contract_class().class_hash,
        map: *declare("MapLogic").unwrap().contract_class().class_hash,
        placement: *declare("PlacementLogic").unwrap().contract_class().class_hash,
        construction: *declare("ConstructionLogic").unwrap().contract_class().class_hash,
        production: *declare("ProductionLogic").unwrap().contract_class().class_hash,
        structures: *declare("StructuresLogic").unwrap().contract_class().class_hash,
        troops: *declare("TroopsLogic").unwrap().contract_class().class_hash,
        settlement: *declare("SettlementLogic").unwrap().contract_class().class_hash,
        resources: *declare("ResourcesLogic").unwrap().contract_class().class_hash,
        economy: *declare("EconomyLogic").unwrap().contract_class().class_hash,
        relics: *declare("RelicsLogic").unwrap().contract_class().class_hash,
        movement: *declare("MovementLogic").unwrap().contract_class().class_hash,
        prizes: *declare("PrizesLogic").unwrap().contract_class().class_hash,
        registry: *declare("RegistryLogic").unwrap().contract_class().class_hash,
        combat: *declare("CombatLogic").unwrap().contract_class().class_hash,
        raid: *declare("RaidLogic").unwrap().contract_class().class_hash,
        bridge: *declare("BridgeLogic").unwrap().contract_class().class_hash,
    };
    let authentication = world_native::games::Authentication {
        submitter: account, account_class: player_class, guardian_public_key: crate::tests::GUARDIAN,
    };
    let mut args = array![administrator.into()];
    authentication.serialize(ref args);
    args.append(1);
    classes.serialize(ref args);
    args.append(0);
    let season = deploy("GamesTest", @args);
    provision_game(season, actor, administrator);
    start_cheat_caller_address(account, administrator);
    ISequencingAuthorityDispatcher { contract_address: account }.configure(season);
    snforge_std::store(snforge_std::test_address(), selector!("conformance_fixture"), array![season.into()].span());
    configure_execution(season);
    snforge_std::cheat_caller_address(account, account, snforge_std::CheatSpan::TargetCalls(1));
    IRandomnessEpochsDispatcher { contract_address: account }.open_randomness_epoch(epoch_commitment(123456));
    start_cheat_caller_address(account, 222.try_into().unwrap());
    season
}
fn configure_execution(season: ContractAddress) {
    let account = IGamesAuthenticationDispatcher { contract_address: season }.authentication().submitter;
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    start_cheat_caller_address(account, 222.try_into().unwrap());
    start_cheat_chain_id_global('TEST');
    stop_cheat_caller_address(season);
    start_cheat_transaction_version(season, 3);
    start_cheat_account_contract_address(season, account);
    start_cheat_transaction_hash(season, 999);
    let (r, s) = signer.sign(999).unwrap();
    start_cheat_signature(season, array![r, s].span());
    start_cheat_resource_bounds(
        season, array![ResourcesBounds { resource: 'L2_GAS', max_amount: 1200000000, max_price_per_unit: 0 }].span(),
    );
    start_cheat_block_timestamp_global(1100);
}
fn provision_game(season: ContractAddress, actor: ContractAddress, administrator: ContractAddress) {
    let data = read_txt(@FileTrait::new("tests/fixtures/preset-3.txt"));
    let mut fields = data.span();
    let rules: world_native::rules::SliceRules = Serde::deserialize(ref fields).unwrap();
    let resources: Span<ResourceRule> = Serde::deserialize(ref fields).unwrap();
    let buildings: Span<world_native::buildings::BuildingRuleConfig> = Serde::deserialize(ref fields).unwrap();
    assert!(fields.is_empty(), "trailing preset fixture");
    let game = GameRegistry {
        name: 'conformance',
        preset_id: 3,
        creator: administrator,
        settled: false,
        ready: true,
        dev_mode_on: true,
        start_settling_at: 0,
        start_main_at: 0,
        end_at: 999999,
        end_grace_seconds: 0,
        seed: 1,
    };
    seed_game(season, 7, game, rules);
    // A second game on the same shard proves each game keeps its own recorded chain.
    seed_game(season, 9, game, rules);
    start_cheat_caller_address(season, administrator);
    let structures = IStructureOperationsDispatcher { contract_address: season };
    let resource_store = IResourceOperationsDispatcher { contract_address: season };
    start_cheat_caller_address(season, administrator);
    resource_store.configure_resources(7, resources);
    start_cheat_caller_address(season, administrator);
    world_native::exploration_rewards::IExtractionDispatcherTrait::configure_extraction(
        world_native::exploration_rewards::IExtractionDispatcher { contract_address: season },
        7,
        array![
            world_native::exploration_rewards::ExplorationReward {
                resource_type: 35, amount: 10, amount_max: 10, weight: 1,
            },
        ]
            .span(),
    );

    world_native::mines::IMineRulesDispatcherTrait::configure_mines(
        world_native::mines::IMineRulesDispatcher { contract_address: season },
        7,
        array![
            world_native::mines::MineKindEntry {
                kind: 1,
                config: world_native::mines::MineKindConfig {
                    resource_type: 38,
                    building_category: 39,
                    production_rate: 2500000000,
                    cap_min: 36000000000000,
                    cap_steps: 1,
                },
            },
            world_native::mines::MineKindEntry {
                kind: 2,
                config: world_native::mines::MineKindConfig {
                    resource_type: 24,
                    building_category: 26,
                    production_rate: 1500000000,
                    cap_min: 300000000000000,
                    cap_steps: 10,
                },
            },
        ]
            .span(),
        array![
            world_native::mines::MineWeight { kind: 1, weight: 1 },
            world_native::mines::MineWeight { kind: 2, weight: 1 },
        ]
            .span(),
    );
    world_native::buildings::IBuildingRulesDispatcherTrait::configure_buildings(
        world_native::buildings::IBuildingRulesDispatcher { contract_address: season }, 7, buildings, None,
    );

    let realm = structures
        .provision_realm(
            7,
            actor,
            Coord { alt: false, x: 2147483626, y: 2147483626 },
            array![(26, 1000000000000), (35, 5000000000000), (36, 5000000000000), (38, 100000000000)].span(),
        );
    start_cheat_caller_address(season, season);
    ICreateExplorerDispatcher { contract_address: season }
        .create_explorer(
            7,
            actor,
            CreateExplorer { structure_id: realm, category: 0, tier: 0, amount: 100000000000, direction: 0 },
            crate::commands::action_context(
                world_native::commands::ExecutionContext {
                    raw_root: 101, timestamp: 900, ..crate::tests::context(season, 7),
                },
            ),
            crate::tests::story_cursor(),
        );
}
pub fn intent(address: ContractAddress) -> Intent {
    // Address 123 belongs to the pure context-boundary vectors, which deploy no contracts.
    let preset_commitment = if address == 123.try_into().unwrap() {
        789
    } else {
        IRecordedExecutionViewsDispatcher { contract_address: address }.get_admission(7, actor()).preset_commitment
    };
    let command = Command::Explore(Explore { explorer_id: 2, direction: 0 });
    let mut arguments = array![];
    command.serialize(ref arguments);
    Intent {
        chain: 'TEST',
        deployment: address.into(),
        game_id: 7,
        actor: if address == 123.try_into().unwrap() {
            456
        } else {
            actor()
        },
        nonce: 0,
        command: command_commitment(command),
        release_id: 1,
        preset_commitment,
        valid_from: 1000,
        valid_until: 1010,
        last_order: 10,
        arguments,
    }
}
pub fn envelope(action: @Intent) -> Envelope {
    Envelope {
        action: action_identity(action),
        order: 1,
        timestamp: 1005,
        release_id: *action.release_id,
        preset_commitment: *action.preset_commitment,
        epoch: 1,
        root: 0x8000000000000000000000000000000000000000000000000000000000000000,
    }
}
pub fn context(envelope: @Envelope) -> ExecutionContext {
    ExecutionContext { envelope: encode_envelope(envelope) }
}
pub fn terminal_arguments(ref action: Intent) {
    let command = Command::Explore(Explore { explorer_id: 2, direction: 6 });
    let mut arguments = array![];
    command.serialize(ref arguments);
    action.arguments = arguments;
    action.command = command_commitment(command);
}

#[derive(Copy, Drop)]
pub struct IFixtureDispatcher {
    pub contract_address: ContractAddress,
}
#[generate_trait]
pub impl IFixtureDispatcherImpl of IFixtureDispatcherTrait {
    fn authority(self: IFixtureDispatcher) -> ContractAddress {
        IGamesAuthenticationDispatcher { contract_address: self.contract_address }.authentication().submitter
    }
}

#[test]
#[feature("safe_dispatcher")]
fn exploration_fixture_runs_the_real_domain() {
    let season = setup();
    let season = season;
    start_cheat_caller_address(season, season);
    IExploreSafeDispatcher { contract_address: season }
        .explore(
            7,
            actor().try_into().unwrap(),
            Explore { explorer_id: 2, direction: 0 },
            crate::commands::action_context(
                world_native::commands::ExecutionContext {
                    raw_root: 1, timestamp: 1005, ..crate::tests::context(season, 7),
                },
            ),
            crate::tests::story_cursor(),
        )
        .unwrap_syscall();
}

#[test]
fn accepted_malformed_commands_are_terminal_and_cannot_stall_the_stream() {
    let address = setup();
    let before = gameplay_state(address);
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    for invalid in 0_u32..5_u32 {
        let nonce: u64 = invalid.into();
        let mut action = intent(address);
        action.nonce = nonce;
        match invalid {
            0 => action.arguments = array![99],
            1 => action.arguments.append(99),
            2 => action.command += 1,
            3 => action.arguments = array![1, 2],
            _ => action.arguments = array![1, 2, 256],
        }
        if invalid != 2 {
            let mut committed = array!['ETERNUM_COMMAND', 1];
            committed.append_span(action.arguments.span());
            action.command = core::poseidon::poseidon_hash_span(committed.span());
        }
        let mut recorded = envelope(@action);
        recorded.order = nonce + 1;
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        IRecordedExecutionDispatcher { contract_address: address }.execute(action, context(@recorded), signed(r, s));
        let rejected = views.recorded_outcome(7, nonce + 1).unwrap();
        assert!(rejected.status == 2, "malformed command must be terminal");
        let expected_class = if invalid == 0 || invalid == 2 {
            'INVALID_COMMAND'
        } else {
            'GAMEPLAY_REJECTED'
        };
        assert_eq!(rejected.status_class, expected_class);
        assert!(rejected.reason.len() != 0, "malformed command needs a named error");
        assert_eq!(gameplay_state(address), before);
        let next = views.get_admission(7, actor());
        assert!(next.nonce == nonce + 1 && next.order == nonce + 2, "malformed command must consume its ticket");
    }
    let next = views.get_admission(7, actor());
    let mut valid = intent(address);
    valid.nonce = next.nonce;
    let mut successor = envelope(@valid);
    successor.order = next.order;
    let (r, s) = pair().sign(action_identity(@valid)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(valid, context(@successor), signed(r, s));
    assert!(views.recorded_outcome(7, next.order).unwrap().status == 1, "valid successor must execute");
}

// Compare gameplay state for the fixture's real explore, excluding deployment identities and recording hashes.
pub fn outcome(address: ContractAddress) -> Array<felt252> {
    let mut values = array![];
    IRecordedExecutionViewsDispatcher { contract_address: address }
        .recorded_outcome(7, 1)
        .unwrap()
        .status
        .serialize(ref values);
    values.append_span(gameplay_state(address).span());
    values
}

fn gameplay_state(address: ContractAddress) -> Array<felt252> {
    let season = address;
    let structures = IStructureOperationsDispatcher { contract_address: season };
    let resource_store = IResourceOperationsDispatcher { contract_address: season };
    let map = world_native::map::IMapLogicDispatcher { contract_address: season };
    let troops = GameState { contract_address: season };
    let points = IPointsDispatcher { contract_address: address };
    let mut values = array![];
    troops.explorer(world_native::troops::ExplorerKey { game_id: 7, explorer_id: 2 }).serialize(ref values);
    for entity_id in array![1_u32, 2] {
        let key = world_native::resources::ResourceKey { game_id: 7, entity_id };
        structures.structure(key).serialize(ref values);
        if resource_store.has_resource(key) {
            resource_snapshot(resource_store, key).serialize(ref values);
        }
        IHyperstructuresDispatcher { contract_address: season }.hyperstructure(key).serialize(ref values);
    }
    let target = Coord { alt: false, x: 2147483628, y: 2147483626 };
    for coord in array![Coord { x: target.x - 1, ..target }, target] {
        map.tile(world_native::geometry::tile_key(7, coord)).serialize(ref values);
    }
    let target_tile = map.tile(world_native::geometry::tile_key(7, target));
    if let Some(tile) = target_tile {
        if tile.data % 2 == 1 {
            let entity_id: u32 = (tile.data / 512 % 0x100000000).try_into().unwrap();
            let key = world_native::resources::ResourceKey { game_id: 7, entity_id };
            structures.structure(key).serialize(ref values);
            resource_snapshot(resource_store, key).serialize(ref values);
            IHyperstructuresDispatcher { contract_address: season }.hyperstructure(key).serialize(ref values);
        }
    }
    for direction in 0_u8..6 {
        let coord = world_native::geometry::neighbor(target, direction);
        map.tile(world_native::geometry::tile_key(7, coord)).serialize(ref values);
    }
    structures
        .building(
            world_native::buildings::BuildingKey {
                game_id: 7, alt: false, outer_col: target.x, outer_row: target.y, inner_col: 10, inner_row: 10,
            },
        )
        .serialize(ref values);
    points.player_points(7, actor().try_into().unwrap()).serialize(ref values);
    points.season_points(7).serialize(ref values);
    IHyperstructuresDispatcher { contract_address: season }.hyperstructure_count(7).serialize(ref values);
    values
}

fn resource_snapshot(
    resource_store: IResourceOperationsDispatcher, key: world_native::resources::ResourceKey,
) -> Array<felt252> {
    let mut values = array![];
    resource_store.resource_weight(key).serialize(ref values);
    for resource_type in 1_u8..59 {
        let slot = world_native::resources::ResourceSlot {
            game_id: key.game_id, entity_id: key.entity_id, resource_type,
        };
        resource_store.resource_balance(slot).serialize(ref values);
        if resource_type < 39 || resource_type > 56 {
            resource_store.resource_production(slot).serialize(ref values);
        }
    }
    values
}

pub fn reject_execution(
    address: ContractAddress, intent: Intent, context: ExecutionContext, r: felt252, s: felt252,
) -> Result<(), Array<felt252>> {
    submit(address, selector!("reject_execution"), intent, context, signed(r, s))
}

fn seed_game(registry: ContractAddress, game_id: u32, game: GameRegistry, rules: world_native::rules::SliceRules) {
    crate::tests::recorded::seed_game(registry, game_id, game, rules);
}
