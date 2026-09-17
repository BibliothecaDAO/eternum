use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::commands::Command;
use crate::dev::{IDevelopmentSafeDispatcher, IDevelopmentSafeDispatcherTrait, MintResources};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceAmount, ResourceKey, ResourceSlot};
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, set_fixture};

fn setup(dev: bool) -> (super::Deployment, ResourceKey) {
    let (d, home, _) = super::resource_commands::setup();
    let games = IGameDispatcher { contract_address: d.peers.season };
    let game = crate::game::GameRegistry { dev_mode_on: dev, ..games.game(3) };
    set_fixture(d.peers.season, selector!("games"), array![3].span(), game);
    (d, home)
}
fn mint(home: ResourceKey, resources: Span<ResourceAmount>) -> Command {
    Command::MintDevelopmentResources(MintResources { entity_id: home.entity_id, resources })
}
fn amount(resource_type: u8, amount: u128) -> Span<ResourceAmount> {
    array![ResourceAmount { resource_type, amount }].span()
}
fn resources(d: super::Deployment) -> IResourcesDispatcher {
    IResourcesDispatcher { contract_address: d.peers.resources }
}
fn balance(d: super::Deployment, home: ResourceKey, resource_type: u8) -> u128 {
    resources(d).resource_balance(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type })
}
#[test]
fn development_mint_settles_production_at_recorded_time_and_updates_weight() {
    let (d, home) = setup(true);
    let d = super::bind_authority(d);
    assert!(execute_recorded_at(d, mint(home, amount(1, 10)), 40, 5000));
    assert_eq!(balance(d, home, 1), 130);
    assert_eq!(resources(d).resource_weight(home).weight, 130);
    let slot = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 1 };
    assert_eq!(resources(d).resource_production(slot).last_updated_at, 40);
    assert_eq!(resources(d).resource_production(slot).output_amount_left, 80);
    assert!(!resources(d).has_resource(ResourceKey { game_id: 2, ..home }));
}
#[test]
fn development_mint_requires_admin_and_a_development_game() {
    let (d, home) = setup(true);
    assert_terminal_rejection(d, mint(home, amount(1, 10)), 40);
    assert_eq!(balance(d, home, 1), 100);
    let d = super::bind_authority(d);
    let games = IGameDispatcher { contract_address: d.peers.season };
    set_fixture(
        d.peers.season,
        selector!("games"),
        array![3].span(),
        crate::game::GameRegistry { dev_mode_on: false, ..games.game(3) },
    );
    assert_terminal_rejection(d, mint(home, amount(1, 10)), 40);
    assert_eq!(balance(d, home, 1), 100);
}
#[test]
fn a_bad_mint_item_reverts_the_entire_batch_but_consumes_the_ticket() {
    let (d, home) = setup(true);
    let d = super::bind_authority(d);
    for invalid in array![
        ResourceAmount { resource_type: 2, amount: 0 }, ResourceAmount { resource_type: 99, amount: 1 },
    ] {
        assert_terminal_rejection(
            d, mint(home, array![ResourceAmount { resource_type: 1, amount: 10 }, invalid].span()), 40,
        );
        assert_eq!(balance(d, home, 1), 100);
        assert_eq!(resources(d).resource_weight(home).weight, 100);
    }
    assert_terminal_rejection(d, mint(ResourceKey { entity_id: 999, ..home }, amount(1, 10)), 40);
    assert!(execute(d, mint(home, amount(1, 10)), 40));
    assert_eq!(balance(d, home, 1), 130);
}
#[test]
fn minting_retains_capacity_clipping_and_empty_batch_behavior() {
    let (d, home) = setup(true);
    let d = super::bind_authority(d);
    let capacity = resources(d).resource_weight(home).capacity;
    assert!(execute(d, mint(home, amount(1, capacity)), 30));
    assert_eq!(balance(d, home, 1), capacity);
    assert_eq!(resources(d).resource_weight(home).weight, capacity);
    assert!(execute(d, mint(home, amount(1, 1)), 30));
    assert_eq!(balance(d, home, 1), capacity);
    assert!(execute(d, mint(ResourceKey { entity_id: 999, ..home }, array![].span()), 30));
}
#[test]
#[feature("safe_dispatcher")]
fn direct_dev_calls_cannot_bypass_the_authenticated_ticket() {
    let (d, home) = setup(true);
    let safe = IDevelopmentSafeDispatcher { contract_address: d.peers.structures };
    for caller in array![super::authority(), d.actor, d.peers.registry] {
        start_cheat_caller_address(d.peers.structures, caller);
        assert!(
            safe
                .mint_resources(
                    3,
                    super::authority(),
                    MintResources { entity_id: home.entity_id, resources: amount(1, 10) },
                    super::context(),
                )
                .is_err(),
        );
    }
    stop_cheat_caller_address(d.peers.structures);
    assert_eq!(balance(d, home, 1), 100);
}
