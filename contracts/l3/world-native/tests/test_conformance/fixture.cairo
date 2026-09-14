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
    Command, CreateExplorer, Explore, ITroopCommandsDispatcher, ITroopCommandsDispatcherTrait,
    ITroopCommandsSafeDispatcher, ITroopCommandsSafeDispatcherTrait, command_commitment,
};
use world_native::game::{GameRegistry, GameStatus, IGameDispatcher, IGameDispatcherTrait};
use world_native::lifecycle::{IDomainDispatcher, IDomainDispatcherTrait, Peers};
use world_native::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use world_native::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, ResourceRule};
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
    fn execute(self: IRecordedExecutionDispatcher, intent: Intent, context: ExecutionContext, r: felt252, s: felt252) {
        submit(self.contract_address, intent, context, r, s).unwrap_syscall();
    }
}
#[generate_trait]
pub impl RecordedSafeDispatcher of IRecordedExecutionSafeDispatcherTrait {
    fn execute(
        self: IRecordedExecutionSafeDispatcher, intent: Intent, context: ExecutionContext, r: felt252, s: felt252,
    ) -> Result<(), Array<felt252>> {
        submit(self.contract_address, intent, context, r, s)
    }
}
#[feature("safe_dispatcher")]
fn submit(
    season: ContractAddress, intent: Intent, context: ExecutionContext, r: felt252, s: felt252,
) -> Result<(), Array<felt252>> {
    // Route through the actual authority account so callbacks from gameplay domains keep their caller.
    let account = ISeasonDispatcher { contract_address: season }.authentication().submitter;
    let epoch = ISequencingAuthorityDispatcher { contract_address: account }.authority_epoch();
    let key = if epoch == 1 {
        54321
    } else {
        67890
    };
    let hash = if epoch == 1 {
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
    calldata.append(r);
    calldata.append(s);
    ISequencingAccountSafeDispatcher { contract_address: account }
        .__execute__(array![Call { to: season, selector: selector!("execute"), calldata: calldata.span() }])
        .map(|_results| ())
}

pub fn pair() -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(12345)
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
        if (ISeasonDispatcher { contract_address: season }).execution_head().order == 0 {
            configure_execution(season);
            return season;
        }
    }
    start_cheat_block_timestamp_global(900);
    start_cheat_chain_id_global('TEST');
    let administrator: ContractAddress = 222.try_into().unwrap();
    let actor: ContractAddress = 456.try_into().unwrap();
    let player_class = declare("ProtocolPlayerFixture").unwrap().contract_class();
    if starknet::syscalls::get_class_hash_at_syscall(actor).unwrap() == 0.try_into().unwrap() {
        player_class.deploy_at(@array![pair().public_key], actor).unwrap();
    }
    let registry = deploy("ProtocolRegistryFixture", @array![]);
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    let account = deploy("SequencingAccount", @array![administrator.into(), signer.public_key]);
    let season = deploy(
        "SeasonDomain",
        @array![administrator.into(), account.into(), registry.into(), (*player_class.class_hash).into()],
    );
    let peers = Peers {
        season,
        map: deploy("MapDomain", @array![administrator.into()]),
        structures: deploy("StructuresDomain", @array![administrator.into()]),
        troops: deploy("TroopsDomain", @array![administrator.into()]),
    };
    for address in array![peers.season, peers.map, peers.structures, peers.troops] {
        start_cheat_caller_address(address, administrator);
        IDomainDispatcher { contract_address: address }.configure(peers);
    }
    for address in array![peers.season, peers.map, peers.structures, peers.troops] {
        IDomainDispatcher { contract_address: address }.activate();
        stop_cheat_caller_address(address);
    }
    provision_game(peers, actor, administrator);
    start_cheat_caller_address(account, administrator);
    ISequencingAuthorityDispatcher { contract_address: account }.configure(season);
    snforge_std::store(snforge_std::test_address(), selector!("conformance_fixture"), array![season.into()].span());
    configure_execution(season);
    season
}
fn configure_execution(season: ContractAddress) {
    let account = ISeasonDispatcher { contract_address: season }.authentication().submitter;
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
fn provision_game(peers: Peers, actor: ContractAddress, administrator: ContractAddress) {
    let data = read_txt(@FileTrait::new("tests/fixtures/preset-1.txt"));
    let mut fields = data.span();
    let rules: world_native::rules::SliceRules = Serde::deserialize(ref fields).unwrap();
    let resources: Span<ResourceRule> = Serde::deserialize(ref fields).unwrap();
    assert!(fields.is_empty(), "trailing preset fixture");
    start_cheat_caller_address(peers.season, administrator);
    IGameDispatcher { contract_address: peers.season }
        .create_game(
            7,
            GameRegistry {
                name: 'conformance',
                series_id: 0,
                game_number_in_series: 0,
                preset_id: 1,
                creator: administrator,
                status: GameStatus::Live,
                dev_mode_on: true,
                start_settling_at: 0,
                start_main_at: 0,
                end_at: 999999,
                end_grace_seconds: 0,
                registration_grace_seconds: 0,
                final_trial_id: 0,
                seed: 1,
            },
            rules,
        );
    stop_cheat_caller_address(peers.season);
    start_cheat_caller_address(peers.structures, administrator);
    let structures = IStructuresDispatcher { contract_address: peers.structures };
    structures.configure_resources(7, resources);
    let realm = structures
        .provision_realm(
            7,
            actor,
            Coord { alt: false, x: 2147483626, y: 2147483626 },
            array![(26, 1000000000000), (35, 5000000000000), (36, 5000000000000), (38, 100000000000)].span(),
        );
    stop_cheat_caller_address(peers.structures);
    start_cheat_caller_address(peers.troops, peers.season);
    ITroopCommandsDispatcher { contract_address: peers.troops }
        .create_explorer(
            7,
            actor,
            CreateExplorer { structure_id: realm, category: 0, tier: 0, amount: 100000000000, direction: 0 },
            world_native::commands::ExecutionContext { raw_root: 101, timestamp: 900 },
        );
    stop_cheat_caller_address(peers.troops);
}
pub fn intent(address: ContractAddress) -> Intent {
    // Address 123 belongs to the pure context-boundary vectors, which deploy no contracts.
    let rules = if address == 123.try_into().unwrap() {
        789
    } else {
        IRecordedExecutionViewsDispatcher { contract_address: address }.get_admission(7, 456).rules
    };
    let command = Command::Explore(Explore { explorer_id: 2, direction: 0 });
    let mut arguments = array![];
    command.serialize(ref arguments);
    Intent {
        chain: 'TEST',
        deployment: address.into(),
        game_id: 7,
        actor: 456,
        nonce: 0,
        command: command_commitment(command),
        rules,
        valid_from: 1000,
        valid_until: 1010,
        last_order: 10,
        arguments,
    }
}
pub fn envelope(action: @Intent) -> Envelope {
    let execution_config = if *action.deployment == 123 {
        987
    } else {
        IRecordedExecutionViewsDispatcher { contract_address: (*action.deployment).try_into().unwrap() }
            .get_admission(7, 456)
            .execution_config
    };
    Envelope {
        action: action_identity(action),
        order: 1,
        predecessor: 0,
        preceding_state: 0,
        timestamp: 1005,
        execution_config,
        l2_gas: 1200000000,
        root: 0x8000000000000000000000000000000000000000000000000000000000000000,
    }
}
pub fn context(envelope: @Envelope) -> ExecutionContext {
    ExecutionContext { envelope: encode_envelope(envelope), authority_epoch: 1, accepted_public_key: pair().public_key }
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
        ISeasonDispatcher { contract_address: self.contract_address }.authentication().submitter
    }
    fn progress(self: IFixtureDispatcher) -> (u64, felt252, felt252, u64, u256) {
        let head = ISeasonDispatcher { contract_address: self.contract_address }.execution_head();
        (head.order, head.binding, head.state, head.timestamp, head.root)
    }
}

#[starknet::contract]
mod ProtocolPlayerFixture {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    #[storage]
    struct Storage {
        key: felt252,
    }
    #[constructor]
    fn constructor(ref self: ContractState, key: felt252) {
        self.key.write(key);
    }
    #[abi(embed_v0)]
    impl Key of world_native::season::IGameplayKey<ContractState> {
        fn get_public_key(self: @ContractState) -> felt252 {
            self.key.read()
        }
    }
}
#[starknet::contract]
mod ProtocolRegistryFixture {
    use starknet::ContractAddress;
    #[storage]
    struct Storage {}
    #[abi(embed_v0)]
    impl Registry of world_native::season::IPlayerRegistry<ContractState> {
        fn owner_of(self: @ContractState, account: ContractAddress) -> ContractAddress {
            if account == 456.try_into().unwrap() {
                123.try_into().unwrap()
            } else {
                0.try_into().unwrap()
            }
        }
        fn account_of(self: @ContractState, owner: ContractAddress) -> ContractAddress {
            if owner == 123.try_into().unwrap() {
                456.try_into().unwrap()
            } else {
                0.try_into().unwrap()
            }
        }
    }
}

#[test]
#[feature("safe_dispatcher")]
fn exploration_fixture_runs_the_real_domain() {
    let season = setup();
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    start_cheat_caller_address(peers.troops, season);
    ITroopCommandsSafeDispatcher { contract_address: peers.troops }
        .explore(
            7,
            456.try_into().unwrap(),
            Explore { explorer_id: 2, direction: 0 },
            world_native::commands::ExecutionContext { raw_root: 1, timestamp: 1005 },
        )
        .unwrap_syscall();
}

#[test]
fn accepted_malformed_commands_are_terminal_and_cannot_stall_the_stream() {
    for invalid in 0_u32..3_u32 {
        let address = setup();
        let mut action = intent(address);
        match invalid {
            0 => action.arguments = array![99],
            1 => action.arguments.append(99),
            _ => action.command += 1,
        }
        let recorded = envelope(@action);
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        IRecordedExecutionDispatcher { contract_address: address }.execute(action, context(@recorded), r, s);
        let views = IRecordedExecutionViewsDispatcher { contract_address: address };
        assert!(views.get_result(1).status == 2, "malformed command must be terminal");
        let next = views.get_admission(7, 456);
        assert!(next.nonce == 1 && next.order == 2, "malformed command must consume its ticket");
        let mut valid = intent(address);
        valid.nonce = next.nonce;
        let mut successor = envelope(@valid);
        successor.order = next.order;
        successor.predecessor = next.predecessor;
        successor.preceding_state = next.preceding_state;
        let (r, s) = pair().sign(action_identity(@valid)).unwrap();
        IRecordedExecutionDispatcher { contract_address: address }.execute(valid, context(@successor), r, s);
        assert!(views.get_result(2).status == 1, "valid successor must execute");
    }
}
