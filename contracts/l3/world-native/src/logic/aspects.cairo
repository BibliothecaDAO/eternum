use starknet::storage::StorageMapReadAccess;
use crate::resources::ResourceKey;

#[cfg(feature: "blitz")]
pub fn rules() -> u128 {
    panic!("Blitz has no Aspects")
}

#[cfg(not(feature: "blitz"))]
pub fn rules() -> u128 {
    crate::aspects::pack(crate::balance::settlement::ORDER_ASPECTS.span())
}

pub fn home_aspect(key: ResourceKey) -> u8 {
    let aspect = crate::state::read().settlements.home_aspects.read((key.game_id, key.entity_id));
    assert!(aspect != 0, "home has no Aspect");
    aspect
}

pub fn shares_aspect(home: ResourceKey, aspect: u8) -> bool {
    aspect != 0 && crate::state::read().settlements.home_aspects.read((home.game_id, home.entity_id)) == aspect
}

pub fn same_aspect(game_id: u32, first: u64, second: u64) -> bool {
    let aspect = crate::state::read().settlements.home_aspects.read((game_id, second));
    shares_aspect(ResourceKey { game_id, entity_id: first }, aspect)
}

#[starknet::component]
pub mod AspectState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use crate::events::RowSet;
    use crate::resources::ResourceKey;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[embeddable_as(AspectsImpl)]
    pub impl Aspects<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::aspects::IAspects<ComponentState<TContractState>> {
        fn draw_realm(self: @ComponentState<TContractState>, order: u8, seed: u256) -> u32 {
            assert!(crate::aspects::order_aspect(super::rules(), order) != 0, "Order has no Aspect");
            assert!(
                self.data.realms.catalogue_count.read() == crate::realms::CANONICAL_REALM_COUNT,
                "incomplete realm catalogue",
            );
            let count: u32 = self.data.realms.order_count.read(order).into();
            assert!(count != 0, "Order has no realms");
            let index: u32 = crate::random::range(seed, 0x4153504543545f5245414c, count.into()).try_into().unwrap();
            self.data.realms.order_realms.read((order, index.try_into().unwrap()))
        }

        fn join(ref self: ComponentState<TContractState>, key: ResourceKey, order: u8) {
            let aspect = crate::aspects::order_aspect(super::rules(), order);
            assert!(
                self.data.settlements.home_aspects.read((key.game_id, key.entity_id)) == 0, "Aspect already chosen",
            );
            self.data.settlements.home_aspects.write((key.game_id, key.entity_id), aspect);
            let members = self.data.settlements.aspect_members.read((key.game_id, aspect)) + 1;
            self.data.settlements.aspect_members.write((key.game_id, aspect), members);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'HomeAspect',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: array![aspect.into()].span(),
                    },
                );
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'AspectMembers',
                        keys: array![key.game_id.into(), aspect.into()].span(),
                        values: array![members.into()].span(),
                    },
                );
        }
    }
}

pub fn dispatcher(game_id: u32) -> crate::aspects::IAspectsLibraryDispatcher {
    crate::aspects::IAspectsLibraryDispatcher {
        class_hash: crate::logic::release::class_of(game_id, crate::slots::REGISTRY),
    }
}
