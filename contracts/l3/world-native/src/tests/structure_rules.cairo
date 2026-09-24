use eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher;
use crate::commands::Command;
use crate::discovery::{Discovery, ethereal, surface};
use crate::map::IMapLogicDispatcher;
use crate::ownership::TransferOwnership;
use crate::resources::{ResourceAmount, ResourceKey};
use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
use crate::tests::state::{MapObservationTrait, StructureObservationTrait};
use crate::upgrades::{UpgradeLimits, UpgradeRecipe};
use super::recorded_receipts::RecordedReceiptsTrait;
use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture, setup, setup_with_rules};

fn record(d: super::Deployment, key: ResourceKey) -> StructureRecord {
    let row = IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap();
    StructureRecord { owner: row.owner, base: row.base, resources_packed: row.resources_packed, metadata: row.metadata }
}
fn save(d: super::Deployment, key: ResourceKey, row: StructureRecord) {
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        row,
    );
}

#[test]
fn level_up_rejects_unowned_missing_wrong_category_unfunded_and_maximum_structures() {
    let mut preset = super::resource_commands::fixture_preset(super::recorded::rules());
    preset.structures.upgrade_limits = UpgradeLimits { realm_max: 1, village_max: 1 };
    preset
        .structures
        .upgrades = array![UpgradeRecipe { costs: array![ResourceAmount { resource_type: 23, amount: 17 }].span() }]
        .span();
    let (d, home, _) = super::resource_commands::setup_with_preset(preset);
    let original = record(d, home);
    assert_terminal_rejection(d, Command::LevelUp(999), 80);
    assert_terminal_rejection(d, Command::LevelUp(home.entity_id), 80);
    assert_eq!(record(d, home), original);
    grant(d, home, 23, 17);
    save(d, home, StructureRecord { owner: 999.try_into().unwrap(), ..original });
    assert_terminal_rejection(d, Command::LevelUp(home.entity_id), 80);
    save(
        d,
        home,
        StructureRecord { base: crate::structures::StructureBase { category: 4, ..original.base }, ..original },
    );
    assert_terminal_rejection(d, Command::LevelUp(home.entity_id), 80);
    save(d, home, original);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let location = crate::geometry::tile_key(3, crate::structures::structure_coord(original.base));
    let tile = map.tile(location).unwrap();
    let storage_key = array![3, location.alt.into(), location.col.into(), location.row.into()].span();
    set_fixture(d.games, selector!("map"), selector!("tiles"), storage_key, tile.data + 512);
    assert_terminal_rejection(d, Command::LevelUp(home.entity_id), 80);
    assert_eq!(record(d, home), original);
    assert_eq!(map.tile(location).unwrap().data, tile.data + 512);
    set_fixture(d.games, selector!("map"), selector!("tiles"), storage_key, tile.data);
    assert!(execute(d, Command::LevelUp(home.entity_id), 80));
    assert_eq!(record(d, home).base.level, 1);
    assert_eq!(map.tile(location).unwrap().data, tile.data + 2);
    assert_terminal_rejection(d, Command::LevelUp(home.entity_id), 80);
    assert_eq!(record(d, home).base.level, 1);
    let outcome = IRecordedExecutionViewsDispatcher { contract_address: d.games }
        .recorded_outcome(3, super::recorded::head(d.games, 3).order)
        .unwrap();
    assert_eq!(outcome.status_class, 'GAMEPLAY_REJECTED');
    // This nested library assertion is longer than a felt short string.
    assert_eq!(outcome.reason, "structure is already at max level");
}

#[test]
fn ownership_transfer_rejects_zero_foreign_village_and_ended_game() {
    let (d, home, _) = setup();
    let original = record(d, home);
    let transfer = |
        owner,
    | Command::TransferStructureOwnership(TransferOwnership { entity_id: home.entity_id, new_owner: owner });
    assert_terminal_rejection(d, transfer(0.try_into().unwrap()), 80);
    save(d, home, StructureRecord { owner: 999.try_into().unwrap(), ..original });
    assert_terminal_rejection(d, transfer(d.actor), 80);
    save(
        d,
        home,
        StructureRecord { base: crate::structures::StructureBase { category: 5, ..original.base }, ..original },
    );
    assert_terminal_rejection(d, transfer(999.try_into().unwrap()), 80);
    save(d, home, original);
    assert!(execute(d, transfer(d.actor), 80));
    assert_eq!(record(d, home), original);
    assert_terminal_rejection(d, transfer(999.try_into().unwrap()), 200);
    assert_eq!(record(d, home), original);
}

#[test]
fn blitz_ownership_transfer_is_rejected_even_by_owner() {
    let mut rules = super::recorded::rules();
    rules.mode_rules = super::recorded::BLITZ_RULES;
    rules.command_mask = super::recorded::BLITZ_COMMAND_MASK;
    rules.entry_rule = crate::rules::ENTRY_ROSTER;
    let (d, home, _) = setup_with_rules(rules);
    assert_terminal_rejection(
        d,
        Command::TransferStructureOwnership(
            TransferOwnership { entity_id: home.entity_id, new_owner: 999.try_into().unwrap() },
        ),
        80,
    );
    assert_eq!(record(d, home).owner, d.actor);
}

#[test]
fn discovery_uses_pinned_weight_totals_offsets_and_layer_restrictions() {
    let config = super::recorded::rules().map_config;
    // Pinned Eternum/Blitz exploration: mine 1000/50000, camp 1500/50000, Bitcoin 200/10000.
    assert_eq!(config.shards_mines_win_probability, 1000);
    assert_eq!(config.shards_mines_fail_probability, 49000);
    assert_eq!(config.camp_win_probability, 1500);
    assert_eq!(config.camp_fail_probability, 48500);
    assert_eq!(config.bitcoin_mine_win_probability, 200);
    assert_eq!(config.bitcoin_mine_fail_probability, 9800);
    // Independent draws from the pinned Poseidon RNG at time 80, offsets 2, 7 and 10.
    assert_eq!(surface(config, 62, 80, 0, 0, crate::rules::DISCOVER_CAMPS), Discovery::Mine); // mine draw 299
    assert_eq!(surface(config, 67, 80, 0, 0, crate::rules::DISCOVER_CAMPS), Discovery::Camp); // mine 8885, camp 299
    assert_eq!(
        surface(config, 53454, 80, 0, 0, crate::rules::DISCOVER_CAMPS), Discovery::Camp,
    ); // mine threshold 1000 is excluded; camp draw 521 wins
    assert_eq!(ethereal(config, true, false, 23568, 80), Discovery::BitcoinMine); // draw 199
    assert_eq!(ethereal(config, true, false, 4175, 80), Discovery::None); // draw 200
    assert_eq!(ethereal(config, false, false, 23568, 80), Discovery::None);
    assert_eq!(ethereal(config, true, true, 23568, 80), Discovery::None);
}
