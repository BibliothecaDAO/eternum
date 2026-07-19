use cartridge_vrf::Source;
use cartridge_vrf::vrf_provider::vrf_provider_component::{
    IVrfProviderDispatcher, IVrfProviderDispatcherTrait, IVrfProviderSafeDispatcher, IVrfProviderSafeDispatcherTrait,
};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address, start_cheat_max_fee_global,
    stop_cheat_caller_address,
};
use stark_vrf::ecvrf::{Point, Proof};
use starknet::ContractAddress;
use crate::utils::testing::contracts::vrf_atomic_consumer::{
    IAtomicVrfConsumerDispatcher, IAtomicVrfConsumerDispatcherTrait, IAtomicVrfConsumerSafeDispatcher,
    IAtomicVrfConsumerSafeDispatcherTrait,
};

const SEED: felt252 = 0x148c79e57bc0ce25e079841517ce9d3499094429644b7288df57a4a16b27721;
const PUBLIC_KEY_X: felt252 = 0x66da5d53168d591c55d4c05f3681663ac51bcdccd5ca09e366b71b0c40ccff4;
const PUBLIC_KEY_Y: felt252 = 0x6d3eb29920bf55195e5ec76f69e247c0942c7ef85f6640896c058ec75ca2232;

#[derive(Copy, Drop)]
struct VrfFixture {
    provider: IVrfProviderDispatcher,
    consumer: IAtomicVrfConsumerDispatcher,
    consumer_address: ContractAddress,
    player: ContractAddress,
}

#[test]
fn released_cartridge_proof_drives_atomic_gameplay_randomness() {
    let fixture = setup_vrf_fixture();
    fixture.provider.request_random(fixture.consumer_address, Source::Nonce(fixture.player));
    fixture.provider.submit_random(SEED, valid_proof());

    start_cheat_caller_address(fixture.consumer_address, fixture.player);
    let random = fixture.consumer.consume_then_mutate(Source::Nonce(fixture.player));
    stop_cheat_caller_address(fixture.consumer_address);

    assert!(random != 0);
    assert!(fixture.consumer.mutation_count() == 1);
    assert!(fixture.consumer.last_random() == random);
    assert!(fixture.provider.get_consume_count() == 1);
    fixture.provider.assert_consumed(SEED);
    assert!(!fixture.provider.is_vrf_call());
}

#[test]
#[feature("safe_dispatcher")]
fn invalid_cartridge_proof_does_not_fulfill_randomness() {
    let fixture = setup_vrf_fixture();
    let provider = IVrfProviderSafeDispatcher { contract_address: fixture.provider.contract_address };

    assert!(provider.submit_random(SEED, invalid_proof()).is_err());
    assert!(!fixture.provider.is_vrf_call());
    assert!(fixture.provider.get_consume_count() == 0);
}

#[test]
#[feature("safe_dispatcher")]
fn unavailable_randomness_cannot_reach_the_gameplay_mutation() {
    let fixture = setup_vrf_fixture();
    let consumer = IAtomicVrfConsumerSafeDispatcher { contract_address: fixture.consumer_address };

    start_cheat_caller_address(fixture.consumer_address, fixture.player);
    assert!(consumer.consume_then_mutate(Source::Nonce(fixture.player)).is_err());
    stop_cheat_caller_address(fixture.consumer_address);

    assert!(fixture.consumer.mutation_count() == 0);
    assert!(fixture.consumer.last_random() == 0);
}

fn setup_vrf_fixture() -> VrfFixture {
    let owner = address('OWNER');
    let player = address('PLAYER1');
    let consumer_address = address('CONSUMER1');
    let provider_address = deploy_provider(owner);
    deploy_consumer(provider_address, consumer_address);
    start_cheat_max_fee_global(10000000000000000);

    VrfFixture {
        provider: IVrfProviderDispatcher { contract_address: provider_address },
        consumer: IAtomicVrfConsumerDispatcher { contract_address: consumer_address },
        consumer_address,
        player,
    }
}

fn deploy_provider(owner: ContractAddress) -> ContractAddress {
    let calldata = array![owner.into(), PUBLIC_KEY_X, PUBLIC_KEY_Y];
    let provider_class = declare("VrfProvider").unwrap().contract_class();
    let (provider_address, _) = provider_class.deploy(@calldata).unwrap();
    provider_address
}

fn deploy_consumer(provider: ContractAddress, consumer_address: ContractAddress) {
    let calldata = array![provider.into()];
    let consumer_class = declare("AtomicVrfConsumer").unwrap().contract_class();
    consumer_class.deploy_at(@calldata, consumer_address).unwrap();
}

fn valid_proof() -> Proof {
    Proof {
        gamma: Point {
            x: 0x1b2146bdf5ef6d13d36e1731bcca759f5cc75baef29cd8d2db2d05356913304,
            y: 0x2ece98350f2ba9dfa54c7cead948912c5c6ab609afcc4a2af726094418c3318,
        },
        c: 0x3c6d3f3af11babb561b90643cff6a115db6ee91b017d0b5e8b716f1ec8eb0a2,
        s: 0x372acefcab4435982285495fbfa4ce6a8608e5b1dfdf9a31ac7df73a92ca202,
        sqrt_ratio_hint: 0x192ddce2f2872355bec6d18b4c6bb8033df94aa57e42442d78d41a9c91ce425,
    }
}

fn invalid_proof() -> Proof {
    let valid = valid_proof();
    Proof { c: valid.c + 1, ..valid }
}

fn address(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}
