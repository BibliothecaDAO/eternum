use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
use crate::army_relics::{ArmyRelic, ArmyRelicEffect, ArmyRelicEffectKey, ArmyRelics, RelicKind};
use crate::resources::ResourceKey;
use crate::troops::ExplorerKey;

pub fn enabled(game_id: u32) -> bool {
    crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read() != 0
}

pub fn read(key: ExplorerKey) -> ArmyRelics {
    let packed = crate::state::read().relics.army_relics.read((key.game_id, key.explorer_id));
    let mut loadout: ArmyRelics = Default::default();
    let mut remaining = packed;
    for index in 0_u8..3 {
        let value: u8 = (remaining % 256).try_into().unwrap();
        if value != 0 {
            crate::army_relics::set_slot(ref loadout, index, Some(crate::army_relics::decode(value)));
        }
        remaining /= 256;
    }
    loadout
}

fn write(key: ExplorerKey, loadout: ArmyRelics) {
    let mut packed = 0_u32;
    let mut scale = 1;
    for index in 0_u8..3 {
        if let Some(relic) = crate::army_relics::slot(loadout, index) {
            packed += Into::<u8, u32>::into(crate::army_relics::encode(relic)) * scale;
        }
        scale *= 256;
    }
    crate::state::write().relics.army_relics.write((key.game_id, key.explorer_id), packed);
    emit_row('ArmyRelics', key, loadout);
}

pub fn effect(key: ArmyRelicEffectKey) -> Option<ArmyRelicEffect> {
    crate::state::read()
        .relics
        .army_relic_effects
        .read((key.game_id, key.explorer_id, crate::army_relics::kind_id(key.kind)))
        .map(|value| {
            let (rank, expires_at) = value;
            ArmyRelicEffect { rank, expires_at }
        })
}

pub fn bonus(key: ExplorerKey, kind: RelicKind, timestamp: u64) -> u32 {
    match effect(ArmyRelicEffectKey { game_id: key.game_id, explorer_id: key.explorer_id, kind }) {
        Some(value) => if timestamp < value.expires_at {
            crate::army_relics::bonus_bps(kind, value.rank)
        } else {
            0
        },
        None => 0,
    }
}

pub fn ruin(key: ResourceKey) -> Option<ArmyRelic> {
    let value = crate::state::read().relics.ruin_relics.read((key.game_id, key.entity_id));
    if value == 0 {
        None
    } else {
        Some(crate::army_relics::decode(value))
    }
}

pub fn store_ruin(key: ResourceKey, relic: ArmyRelic) {
    assert!(ruin(key).is_none(), "ruin relic already stored");
    crate::state::write().relics.ruin_relics.write((key.game_id, key.entity_id), crate::army_relics::encode(relic));
    emit_row('RuinRelic', key, relic);
}

pub fn award(key: ExplorerKey, site: ResourceKey, replace: Option<u8>) {
    let relic = ruin(site).expect('missing ruin relic');
    let mut loadout = read(key);
    crate::army_relics::receive(ref loadout, relic, replace);
    write(key, loadout);
    crate::state::write().relics.ruin_relics.write((site.game_id, site.entity_id), 0);
    delete_row('RuinRelic', site);
}

pub fn activate(key: ExplorerKey, index: u8, expected: u8, timestamp: u64) -> ArmyRelic {
    let mut loadout = read(key);
    let relic = crate::army_relics::slot(loadout, index).expect('empty relic slot');
    assert!(crate::army_relics::encode(relic) == expected, "relic slot changed");
    crate::army_relics::set_slot(ref loadout, index, None);
    write(key, loadout);
    if relic.kind != RelicKind::FarEye {
        let effect_key = ArmyRelicEffectKey { game_id: key.game_id, explorer_id: key.explorer_id, kind: relic.kind };
        let value = ArmyRelicEffect {
            rank: relic.rank,
            expires_at: timestamp + Into::<u32, u64>::into(crate::rules::RELIC_SECONDS_PER_RANK) * relic.rank.into(),
        };
        crate::state::write()
            .relics
            .army_relic_effects
            .write(
                (key.game_id, key.explorer_id, crate::army_relics::kind_id(relic.kind)),
                Some((value.rank, value.expires_at)),
            );
        emit_row('ArmyRelicEffect', effect_key, value);
    }
    relic
}

pub fn combat_boosts(key: ExplorerKey, ref boosts: crate::troops::TroopBoosts, timestamp: u64) {
    boosts.incr_damage_dealt_percent_num += bonus(key, RelicKind::Blade, timestamp).try_into().unwrap();
    boosts.decr_damage_gotten_percent_num += bonus(key, RelicKind::Ward, timestamp).try_into().unwrap();
}

pub fn destroy(key: ExplorerKey) {
    if read(key) != Default::default() {
        crate::state::write().relics.army_relics.write((key.game_id, key.explorer_id), 0);
        delete_row('ArmyRelics', key);
    }
    for kind_id in 0_u8..5 {
        let effect_key = ArmyRelicEffectKey {
            game_id: key.game_id, explorer_id: key.explorer_id, kind: crate::army_relics::kind_at(kind_id),
        };
        if effect(effect_key).is_some() {
            crate::state::write().relics.army_relic_effects.write((key.game_id, key.explorer_id, kind_id), None);
            delete_row('ArmyRelicEffect', effect_key);
        }
    }
}

fn emit_row<K, V, +Serde<K>, +Serde<V>, +Drop<K>, +Drop<V>>(model: felt252, key: K, value: V) {
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    value.serialize(ref values);
    ArmyRelicState::emit(
        ArmyRelicState::Event::RowSet(
            crate::events::RowSet { version: 1, model, keys: keys.span(), values: values.span() },
        ),
    );
}

fn delete_row<K, +Serde<K>, +Drop<K>>(model: felt252, key: K) {
    let mut keys = array![];
    key.serialize(ref keys);
    ArmyRelicState::emit(
        ArmyRelicState::Event::RowDeleted(crate::events::RowDeleted { version: 1, model, keys: keys.span() }),
    );
}

pub fn site_reward(
    key: ExplorerKey, reward: crate::resources::ResourceAmount, timestamp: u64,
) -> crate::resources::ResourceAmount {
    if reward.resource_type != crate::resources::LABOR && reward.resource_type != crate::resources::ESSENCE {
        return reward;
    }
    let extra: u128 = bonus(key, RelicKind::Plunder, timestamp).into();
    crate::resources::ResourceAmount { amount: reward.amount * (10_000 + extra) / 10_000, ..reward }
}

pub fn reveal_tiles(game_id: u32, origin: crate::troops::Coord, count: u8, context: crate::commands::BiomeContext) {
    assert!(count > 0 && count <= 5 * crate::rules::RELIC_TILES_PER_RANK, "invalid relic tile count");
    let spacing = crate::logic::settlement::rules(game_id).spacing;
    assert!(!crate::deep::contains(origin, spacing), "Deep terrain is already visible");
    let mut revealed = 0;
    for radius in 1..spacing {
        for direction in 0_u8..6 {
            for step in 0..radius {
                let Some(point) = crate::geometry::checked_neighbor_at_distance(origin, direction, radius)
                    .and_then(
                        |corner| crate::geometry::checked_neighbor_at_distance(corner, (direction + 2) % 6, step),
                    ) else {
                    continue;
                };
                if !crate::expeditions::inside_region(origin, point, spacing) {
                    continue;
                }
                let key = crate::geometry::tile_key(game_id, point);
                if crate::logic::map::tile(key)
                    .map(|tile| tile.data / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE != 0)
                    .unwrap_or(false) {
                    continue;
                }
                crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key, context));
                revealed += 1;
                if revealed == count {
                    return;
                }
            }
        }
    }
    assert!(revealed != 0, "no unrevealed tiles in this layer");
}

#[starknet::component]
pub mod ArmyRelicState {
    use starknet::Event as EventTrait;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: crate::events::RowSet,
        RowDeleted: crate::events::RowDeleted,
    }
    pub fn emit(event: Event) {
        let mut keys = array![selector!("ArmyRelicEvent")];
        let mut data = array![];
        event.append_keys_and_data(ref keys, ref data);
        starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
    }
    #[embeddable_as(ViewsImpl)]
    pub impl Views<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::army_relics::IArmyRelics<ComponentState<TContractState>> {
        fn army_relics(
            self: @ComponentState<TContractState>, key: crate::troops::ExplorerKey,
        ) -> crate::army_relics::ArmyRelics {
            super::read(key)
        }
        fn army_relic_effect(
            self: @ComponentState<TContractState>, key: crate::army_relics::ArmyRelicEffectKey,
        ) -> Option<crate::army_relics::ArmyRelicEffect> {
            super::effect(key)
        }
        fn ruin_relic(
            self: @ComponentState<TContractState>, key: crate::resources::ResourceKey,
        ) -> Option<crate::army_relics::ArmyRelic> {
            super::ruin(key)
        }
    }
}
