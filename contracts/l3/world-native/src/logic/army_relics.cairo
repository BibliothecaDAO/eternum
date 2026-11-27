use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::army_relics::{
    ArmyRelic, ArmyRelicEffect, ArmyRelicEffectKey, ArmyRelics, RelicCollectOutcome, RelicCollected, RelicKind,
};
use crate::resources::ResourceKey;
use crate::troops::ExplorerKey;

pub fn read(key: ExplorerKey) -> ArmyRelics {
    let packed = crate::state::read().relics.army_relics.read((key.game_id, key.explorer_id));
    ArmyRelics {
        blade: (packed % 8).try_into().unwrap(),
        ward: (packed / 8 % 8).try_into().unwrap(),
        plunder: (packed / 64 % 8).try_into().unwrap(),
        stamina_regen: (packed / 512 % 8).try_into().unwrap(),
        antidote: (packed / 4096 % 8).try_into().unwrap(),
    }
}

fn write(key: ExplorerKey, loadout: ArmyRelics) {
    assert!(
        loadout.blade <= 5
            && loadout.ward <= 5
            && loadout.plunder <= 5
            && loadout.stamina_regen <= 5
            && loadout.antidote <= 5,
        "invalid relic rank",
    );
    let packed: u32 = loadout.blade.into()
        + Into::<u8, u32>::into(loadout.ward) * 8
        + Into::<u8, u32>::into(loadout.plunder) * 64
        + Into::<u8, u32>::into(loadout.stamina_regen) * 512
        + Into::<u8, u32>::into(loadout.antidote) * 4096;
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

pub fn award(key: ExplorerKey, site: ResourceKey, timestamp: u64) {
    let relic = ruin(site).expect('missing ruin relic');
    let cache = crate::state::read().relics.ruin_caches.read((site.game_id, site.entity_id));
    if cache == 0 {
        let mut loadout = read(key);
        let (previous_rank, result_rank, outcome) = crate::army_relics::collect(ref loadout, relic);
        if outcome != RelicCollectOutcome::Discarded {
            write(key, loadout);
        }
        let collected = RelicCollected {
            explorer_id: key.explorer_id,
            site_id: site.entity_id,
            kind: relic.kind,
            found_rank: relic.rank,
            previous_rank,
            result_rank,
            outcome,
        };
        if let Some(army) = crate::logic::troops::explorer(key) {
            let owner = crate::logic::structures::owner(ResourceKey { game_id: key.game_id, entity_id: army.owner });
            crate::logic::stories::emit_entity_story(
                ResourceKey { game_id: key.game_id, entity_id: key.explorer_id },
                owner,
                crate::ownership::Story::RelicCollected(collected),
                timestamp,
            );
        }
    } else {
        crate::state::write().relics.ruin_caches.write((site.game_id, site.entity_id), 0);
        delete_row('RuinCache', site);
        let army = crate::logic::troops::explorer(key).expect('missing explorer');
        let owner = crate::logic::structures::record(ResourceKey { game_id: key.game_id, entity_id: army.owner }).owner;
        crate::logic::fragments::add(key.game_id, owner, cache);
    }
    crate::state::write().relics.ruin_relics.write((site.game_id, site.entity_id), 0);
    delete_row('RuinRelic', site);
}

pub fn store_cache(key: ResourceKey, relic: ArmyRelic, depth: u8) {
    let amount = crate::fragments::cache_fragments(relic, depth);
    crate::state::write().relics.ruin_caches.write((key.game_id, key.entity_id), amount);
    emit_row('RuinCache', key, amount);
}

pub fn activate(
    key: ExplorerKey, kind: RelicKind, expected_rank: u8, timestamp: u64, seconds_per_rank: u32,
) -> ArmyRelic {
    let mut loadout = read(key);
    let rank = crate::army_relics::rank_of(loadout, kind);
    assert!(rank != 0, "empty relic slot");
    assert!(rank == expected_rank, "relic slot changed");
    crate::army_relics::set_rank(ref loadout, kind, 0);
    write(key, loadout);
    let effect_key = ArmyRelicEffectKey { game_id: key.game_id, explorer_id: key.explorer_id, kind };
    let value = ArmyRelicEffect {
        rank, expires_at: timestamp + Into::<u32, u64>::into(seconds_per_rank) * rank.into(),
    };
    crate::state::write()
        .relics
        .army_relic_effects
        .write((key.game_id, key.explorer_id, crate::army_relics::kind_id(kind)), Some((value.rank, value.expires_at)));
    emit_row('ArmyRelicEffect', effect_key, value);
    ArmyRelic { kind, rank }
}

pub fn active_boost(key: ExplorerKey, kind: RelicKind, timestamp: u64) -> (u16, u32) {
    match effect(ArmyRelicEffectKey { game_id: key.game_id, explorer_id: key.explorer_id, kind }) {
        Some(value) => if timestamp < value.expires_at {
            (crate::army_relics::bonus_bps(kind, value.rank).try_into().unwrap(), value.expires_at.try_into().unwrap())
        } else {
            (0, 0)
        },
        None => (0, 0),
    }
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
    for kind_id in 0_u8..crate::army_relics::RELIC_KIND_COUNT {
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

pub fn start_stamina_regen(key: ExplorerKey, settled: crate::troops::ExplorerTroops) {
    let stored = crate::logic::troops::explorer(key).expect('missing explorer');
    let army = crate::troops::ExplorerTroops {
        troops: crate::troops::Troops { boosts: stored.troops.boosts, ..settled.troops }, ..settled,
    };
    crate::logic::troops::TroopState::save(key, crate::troops::ExplorerRecordTrait::into_record(army));
}

pub fn stamina_regen_boost(key: ExplorerKey, settled_at: u64) -> (u16, u16) {
    let Some(active) = effect(
        ArmyRelicEffectKey { game_id: key.game_id, explorer_id: key.explorer_id, kind: RelicKind::StaminaRegen },
    ) else {
        return (0, 0);
    };
    if active.expires_at <= settled_at {
        return (0, 0);
    }
    (
        crate::army_relics::bonus_bps(RelicKind::StaminaRegen, active.rank).try_into().unwrap(),
        (active.expires_at - settled_at).try_into().unwrap(),
    )
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
