#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Coord {
    pub alt: bool,
    pub x: u32,
    pub y: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub enum TroopType {
    #[default]
    Knight,
    Paladin,
    Crossbowman,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub enum TroopTier {
    #[default]
    T1,
    T2,
    T3,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Stamina {
    pub amount: u64,
    pub updated_tick: u64,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct TroopBoosts {
    pub incr_damage_dealt_percent_num: u16,
    pub incr_damage_dealt_end_tick: u32,
    pub decr_damage_gotten_percent_num: u16,
    pub decr_damage_gotten_end_tick: u32,
    pub incr_stamina_regen_percent_num: u16,
    pub incr_stamina_regen_tick_count: u8,
    pub incr_explore_reward_percent_num: u16,
    pub incr_explore_reward_end_tick: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Troops {
    pub category: TroopType,
    pub tier: TroopTier,
    pub count: u128,
    pub stamina: Stamina,
    pub boosts: TroopBoosts,
    pub battle_cooldown_end: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExplorerKey {
    pub game_id: u32,
    pub explorer_id: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ExplorerTroops {
    pub owner: u32,
    pub troops: Troops,
    pub coord: Coord,
}

#[starknet::component]
pub mod TroopState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowMemberSet, RowSet};
    use super::{ExplorerKey, ExplorerTroops, Troops};
    #[storage]
    pub struct Storage {
        pub explorers: Map<(u32, u32), ExplorerTroops>,
        pub exists: Map<(u32, u32), bool>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowMemberSet: RowMemberSet,
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn explorer(self: @ComponentState<TContractState>, key: ExplorerKey) -> Option<ExplorerTroops> {
            if self.exists.read((key.game_id, key.explorer_id)) {
                Some(self.explorers.read((key.game_id, key.explorer_id)))
            } else {
                None
            }
        }
        fn create(ref self: ComponentState<TContractState>, key: ExplorerKey, explorer: ExplorerTroops) {
            assert!(key.game_id != 0 && key.explorer_id != 0, "reserved explorer key");
            assert!(self.explorer(key).is_none(), "explorer already exists");
            self.explorers.write((key.game_id, key.explorer_id), explorer);
            self.exists.write((key.game_id, key.explorer_id), true);
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            explorer.serialize(ref values);
            self.emit(RowSet { version: 1, model: 'ExplorerTroops', keys: keys.span(), values: values.span() });
        }
        fn update_troops(ref self: ComponentState<TContractState>, key: ExplorerKey, troops: Troops) {
            let mut explorer = self.explorer(key).expect('missing explorer');
            explorer.troops = troops;
            self.explorers.write((key.game_id, key.explorer_id), explorer);
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            troops.serialize(ref values);
            self
                .emit(
                    RowMemberSet {
                        version: 1, model: 'ExplorerTroops', member: 'troops', keys: keys.span(), values: values.span(),
                    },
                );
        }
        fn destroy(ref self: ComponentState<TContractState>, key: ExplorerKey) {
            assert!(self.explorer(key).is_some(), "missing explorer");
            // The existence bit is authoritative; recreation overwrites the complete value.
            self.exists.write((key.game_id, key.explorer_id), false);
            let mut keys = array![];
            key.serialize(ref keys);
            self.emit(RowDeleted { version: 1, model: 'ExplorerTroops', keys: keys.span() });
        }
    }
}

#[starknet::interface]
pub trait ITroops<T> {
    fn explorer(self: @T, key: ExplorerKey) -> Option<ExplorerTroops>;
}

#[starknet::contract]
pub mod TroopsDomain {
    use starknet::ContractAddress;
    use crate::lifecycle::Lifecycle;
    use super::{ExplorerKey, ExplorerTroops, TroopState};
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: TroopState, storage: troops, event: TroopEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    impl TroopInternal = TroopState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        troops: TroopState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        TroopEvent: TroopState::Event,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl Troops of super::ITroops<ContractState> {
        fn explorer(self: @ContractState, key: ExplorerKey) -> Option<ExplorerTroops> {
            self.troops.explorer(key)
        }
    }
}
