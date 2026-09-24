//! The gateway packs at most `MAX_BATCH` player tickets into one sequencing transaction (apps/gateway/src/service.rs).
//! This proves the bound against the node's execution cap: that many of the costliest player action, an explore that
//! discovers a camp, executed as one batch, stay inside one transaction's Sierra gas.
use eternum_randomness_protocol::entrypoint::{
    IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait, IRecordedExecutionViewsDispatcher, RecordedAction,
};
use eternum_randomness_protocol::{decode_envelope, encode_envelope};
use snforge_std::{CheatSpan, cheat_caller_address, start_cheat_block_timestamp_global, start_cheat_caller_address};
use crate::buildings::{IBuildingRulesDispatcher, IBuildingRulesDispatcherTrait};
use crate::camps::{ICampRulesDispatcher, ICampRulesDispatcherTrait};
use crate::commands::{Command, CreateExplorer, ExecutionContext, Explore};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::games::{IGamesAuthenticationDispatcher, IGamesAuthenticationDispatcherTrait};
use crate::geometry::{neighbor, tile_key};
use crate::map::IMapLogicDispatcher;
use crate::resources::{ResourceAmount, ResourceKey};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::IStructureOperationsDispatcher;
use crate::tests::state::{GameState, MapObservationTrait, StructureObservationTrait, TroopObservationTrait};
use crate::troops::ExplorerKey;
use super::recorded::{FixtureAction, make_context, make_intent};
use super::recorded_receipts::RecordedReceiptsTrait;
use super::resource_commands::{execute, grant, setup_with_rules};
use super::{Deployment, signature, submitter};

/// The gateway's `MAX_BATCH`; change both together.
const GATEWAY_MAX_BATCH: u8 = 6;
/// Sierra gas one transaction may execute under the node's versioned constants (0.14.2), the cap the gateway's
/// comment on `MAX_BATCH` names.
const TRANSACTION_SIERRA_GAS_CAP: u128 = 1_100_000_000;
const TICKET_TIMESTAMP: u64 = 140;

#[test]
fn a_full_batch_of_camp_discovering_explores_fits_one_transaction() {
    let (d, home) = setup_realm_with_explorers(GATEWAY_MAX_BATCH);
    let explorers = IStructureOperationsDispatcher { contract_address: d.games }
        .structure(home)
        .unwrap()
        .troop_explorers;
    let batch = explore_outward_batch(d, explorers);

    start_cheat_block_timestamp_global(5000);
    cheat_caller_address(d.games, submitter(), CheatSpan::TargetCalls(1));
    let before = core::testing::get_available_gas();
    IRecordedExecutionDispatcher { contract_address: d.games }.execute_batch(batch);
    let spent = before - core::testing::get_available_gas();
    println!("{} camp-discovering explores in one batch: {} Sierra gas", GATEWAY_MAX_BATCH, spent);

    assert_every_explore_discovered_a_camp(d, explorers);
    assert!(spent < TRANSACTION_SIERRA_GAS_CAP, "a full batch exceeds one transaction's execution cap");
}

/// A Blitz realm whose explorers each discover a camp on their first explore, with room for `count` armies.
fn setup_realm_with_explorers(count: u8) -> (Deployment, ResourceKey) {
    let mut rules = super::camps::rules(true);
    rules.troop_limit_config.settlement_armies = count.into();
    let (d, home, _) = setup_with_rules(rules);
    start_cheat_caller_address(d.games, super::authority());
    IBuildingRulesDispatcher { contract_address: d.games }
        .configure_buildings(3, super::building_commands::rules(), None);
    ICampRulesDispatcher { contract_address: d.games }
        .configure_camps(
            3,
            array![ResourceAmount { resource_type: 1, amount: 100 }, ResourceAmount { resource_type: 2, amount: 20 }]
                .span(),
        );
    super::relics::configure_extraction(d, 2, 10);
    for resource in array![26_u8, 35, 36] {
        grant(d, home, resource, 100 * RESOURCE_PRECISION);
    }
    for direction in 0..count {
        let army = CreateExplorer {
            structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction,
        };
        assert!(execute(d, Command::CreateExplorer(army), 80));
    }
    (d, home)
}

/// One explore per army, each away from the realm into unrevealed ground, signed and ordered as the gateway would
/// submit them: consecutive nonces and consecutive positions in the game's chain.
fn explore_outward_batch(d: Deployment, explorers: Span<u32>) -> Array<RecordedAction> {
    let first_nonce = IGamesAuthenticationDispatcher { contract_address: d.games }.next_nonce(3, d.actor);
    let first_order = super::recorded::head(d.games, 3).order + 1;
    let rules = IGameDispatcher { contract_address: d.games }.rules(3);
    let mut batch = array![];
    for index in 0..explorers.len() {
        let action = FixtureAction {
            game_id: 3,
            rules,
            actor: d.actor,
            nonce: first_nonce + index.into(),
            deadline: 10000,
            // Army `index` stands on the realm's neighbor in direction `index`, so this reaches ground two tiles out.
            command: Command::Explore(
                Explore { explorer_id: *explorers.at(index), direction: index.try_into().unwrap() },
            ),
        };
        batch
            .append(
                RecordedAction {
                    intent: make_intent(d.games, action),
                    context: at_order(d, action, first_order + index.into()),
                    signature: signature(d, action),
                },
            );
    }
    batch
}

/// The ticket's context at a given position in the game's chain; the fixture context places it at the next one.
fn at_order(
    d: Deployment, action: FixtureAction, order: u64,
) -> eternum_randomness_protocol::entrypoint::ExecutionContext {
    let next = make_context(d.games, action, ExecutionContext { raw_root: 987654321, timestamp: TICKET_TIMESTAMP });
    let mut envelope = decode_envelope(next.envelope.span()).unwrap();
    envelope.order = order;
    eternum_randomness_protocol::entrypoint::ExecutionContext { envelope: encode_envelope(@envelope) }
}

/// A rejected ticket costs a fraction of an executed one, so the bound only means something if every explore ran.
fn assert_every_explore_discovered_a_camp(d: Deployment, explorers: Span<u32>) {
    let views = IRecordedExecutionViewsDispatcher { contract_address: d.games };
    let head = super::recorded::head(d.games, 3).order;
    let first = head - explorers.len().into() + 1;
    let map = IMapLogicDispatcher { contract_address: d.games };
    for index in 0..explorers.len() {
        assert_eq!(views.recorded_outcome(3, first + index.into()).unwrap().status, 1);
        let army = GameState { contract_address: d.games }
            .explorer(ExplorerKey { game_id: 3, explorer_id: *explorers.at(index) })
            .unwrap();
        let destination = neighbor(army.coord, index.try_into().unwrap());
        let tile = map.tile(tile_key(3, destination)).unwrap();
        assert_eq!((tile.data / 2) % 256, crate::camps::CAMP_OCCUPIER.into());
    }
}
