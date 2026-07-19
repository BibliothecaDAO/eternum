use settlement_protocol::appchain_spike_interfaces::{
    IGameSettlementAdapterSpikeDispatcher, IGameSettlementAdapterSpikeDispatcherTrait,
    ISeasonSettlementHubSpikeDispatcher, ISeasonSettlementHubSpikeDispatcherTrait,
};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;

const GAME_A: felt252 = 101;
const GAME_B: felt252 = 202;

struct Fixture {
    hub: ISeasonSettlementHubSpikeDispatcher,
    hub_address: ContractAddress,
    adapter_a: IGameSettlementAdapterSpikeDispatcher,
    adapter_b: IGameSettlementAdapterSpikeDispatcher,
    world_a: ContractAddress,
    world_b: ContractAddress,
}

#[test]
fn one_root_stream_accepts_two_factory_worlds_without_cross_world_resolution() {
    let fixture = setup();

    let nonce_a = fixture.adapter_a.append_claim(11);
    let nonce_b = fixture.adapter_b.append_claim(22);

    assert!(nonce_a == 0);
    assert!(nonce_b == 1);
    assert!(fixture.hub.stream_length() == 2);

    let entry_a = fixture.hub.get_entry(0).unwrap();
    let entry_b = fixture.hub.get_entry(1).unwrap();
    assert!(entry_a.game_id == GAME_A);
    assert!(entry_a.world == fixture.world_a);
    assert!(entry_a.adapter == fixture.adapter_a.contract_address);
    assert!(entry_a.amount == 11);
    assert!(entry_b.game_id == GAME_B);
    assert!(entry_b.world == fixture.world_b);
    assert!(entry_b.adapter == fixture.adapter_b.contract_address);
    assert!(entry_b.amount == 22);
}

#[test]
#[should_panic(expected: "UNREGISTERED_ADAPTER")]
fn direct_hub_append_cannot_supply_or_infer_an_authoritative_game() {
    let fixture = setup();
    fixture.hub.append_claim(99);
}

#[test]
#[should_panic(expected: "ADAPTER_BINDING_MISMATCH")]
fn registration_cannot_bind_an_adapter_to_another_world() {
    let fixture = deploy_unregistered_fixture();

    start_cheat_caller_address(fixture.hub_address, admin());
    fixture.hub.register_game(GAME_B, fixture.world_b, fixture.adapter_a.contract_address);
}

fn setup() -> Fixture {
    let fixture = deploy_unregistered_fixture();
    start_cheat_caller_address(fixture.hub_address, admin());
    fixture.hub.register_game(GAME_A, fixture.world_a, fixture.adapter_a.contract_address);
    fixture.hub.register_game(GAME_B, fixture.world_b, fixture.adapter_b.contract_address);
    stop_cheat_caller_address(fixture.hub_address);
    fixture
}

fn deploy_unregistered_fixture() -> Fixture {
    let hub_address = deploy("SeasonSettlementHubSpike", array![admin().into()]);
    let world_a = deploy("FactoryWorldSpike", array![GAME_A]);
    let world_b = deploy("FactoryWorldSpike", array![GAME_B]);
    let adapter_a = deploy("GameSettlementAdapterSpike", array![hub_address.into(), GAME_A, world_a.into()]);
    let adapter_b = deploy("GameSettlementAdapterSpike", array![hub_address.into(), GAME_B, world_b.into()]);

    Fixture {
        hub: ISeasonSettlementHubSpikeDispatcher { contract_address: hub_address },
        hub_address,
        adapter_a: IGameSettlementAdapterSpikeDispatcher { contract_address: adapter_a },
        adapter_b: IGameSettlementAdapterSpikeDispatcher { contract_address: adapter_b },
        world_a,
        world_b,
    }
}

fn deploy(name: ByteArray, calldata: Array<felt252>) -> ContractAddress {
    let contract = declare(name).unwrap().contract_class();
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}
