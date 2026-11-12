use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use crate::resources::ResourceKey;

pub fn rules(game_id: u32) -> Option<u128> {
    crate::logic::preset_record::for_game(game_id).order_aspects.read()
}

pub fn home_aspect(key: ResourceKey) -> u8 {
    let aspect = crate::state::read().settlements.home_aspects.read((key.game_id, key.entity_id));
    assert!(aspect != 0, "home has no Aspect");
    aspect
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
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn draw_realm(self: @ComponentState<TContractState>, orders: u128, aspect: u8, seed: u256) -> u32 {
            assert!(aspect >= 1 && aspect <= 4, "choose an Aspect");
            assert!(
                self.data.realms.catalogue_count.read() == crate::realms::CANONICAL_REALM_COUNT,
                "incomplete realm catalogue",
            );
            let mut count = 0_u32;
            for order in 1_u8..17 {
                if crate::aspects::order_aspect(orders, order) == aspect {
                    count += self.data.realms.order_count.read(order).into();
                }
            }
            assert!(count != 0, "Aspect has no realms");
            let mut index: u32 = crate::random::range(seed, 0x4153504543545f5245414c, count.into()).try_into().unwrap();
            for order in 1_u8..17 {
                if crate::aspects::order_aspect(orders, order) == aspect {
                    let count: u32 = self.data.realms.order_count.read(order).into();
                    if index < count {
                        return self.data.realms.order_realms.read((order, index.try_into().unwrap()));
                    }
                    index -= count;
                }
            }
            panic!("Aspect realm index out of bounds");
        }

        fn join(ref self: ComponentState<TContractState>, key: ResourceKey, order: u8, selected: Option<u8>) {
            let Some(orders) = super::rules(key.game_id) else {
                assert!(selected.is_none(), "Aspects are disabled");
                return;
            };
            let aspect = crate::aspects::order_aspect(orders, order);
            if let Some(selected) = selected {
                assert!(selected == aspect, "Realm belongs to another Aspect");
            }
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
