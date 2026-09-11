use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use starknet::ContractAddress;

pub const CANONICAL_REALM_COUNT: u32 = 8000;

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct RealmAllocationPool {
    #[key]
    pub game_id: u32,
    pub initialized: bool,
    pub remaining: u32,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct RealmAllocationSlot {
    #[key]
    pub game_id: u32,
    #[key]
    pub index: u32,
    pub realm_id: u32,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct RealmAllocation {
    #[key]
    pub game_id: u32,
    #[key]
    pub realm_id: u32,
    pub player: ContractAddress,
    pub index_plus_one: u32,
}

/// A sparse swap-remove pool samples without replacement in constant storage work.
/// Unwritten slots and reverse indices represent the identity permutation.
#[generate_trait]
pub impl RealmAllocationImpl of RealmAllocationTrait {
    fn remaining(world: WorldStorage, game_id: u32) -> u32 {
        let pool: RealmAllocationPool = world.read_model(game_id);
        if pool.initialized {
            pool.remaining
        } else {
            CANONICAL_REALM_COUNT
        }
    }

    fn at(world: WorldStorage, game_id: u32, index: u32) -> u32 {
        assert!(index < Self::remaining(world, game_id), "Eternum: realm pool index out of range");
        let slot: RealmAllocationSlot = world.read_model((game_id, index));
        if slot.realm_id == 0 {
            index + 1
        } else {
            slot.realm_id
        }
    }

    fn reserve(ref world: WorldStorage, game_id: u32, realm_id: u32, player: ContractAddress) {
        assert!(realm_id > 0 && realm_id <= CANONICAL_REALM_COUNT, "Eternum: invalid canonical realm");
        assert!(player.is_non_zero(), "Eternum: invalid realm player");
        let mut allocation: RealmAllocation = world.read_model((game_id, realm_id));
        assert!(allocation.player.is_zero(), "Eternum: canonical realm already allocated");
        let remaining = Self::remaining(world, game_id);
        assert!(remaining > 0, "Eternum: all canonical realms allocated");
        let index = if allocation.index_plus_one == 0 {
            realm_id - 1
        } else {
            allocation.index_plus_one - 1
        };
        let last_id = Self::at(world, game_id, remaining - 1);
        if index != remaining - 1 {
            world.write_model(@RealmAllocationSlot { game_id, index, realm_id: last_id });
            let mut moved: RealmAllocation = world.read_model((game_id, last_id));
            moved.game_id = game_id;
            moved.realm_id = last_id;
            moved.index_plus_one = index + 1;
            world.write_model(@moved);
        }
        allocation.game_id = game_id;
        allocation.realm_id = realm_id;
        allocation.player = player;
        world.write_model(@allocation);
        world.write_model(@RealmAllocationPool { game_id, initialized: true, remaining: remaining - 1 });
    }
}

#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::WorldStorage;
    use dojo_snf_test::{NamespaceDef, TestResource, spawn_test_world};
    use crate::constants::DEFAULT_NS_STR;
    use super::{RealmAllocationImpl, RealmAllocationPool};

    fn setup() -> WorldStorage {
        spawn_test_world(
            [
                NamespaceDef {
                    namespace: DEFAULT_NS_STR(),
                    resources: [
                        TestResource::Model("RealmAllocationPool"), TestResource::Model("RealmAllocationSlot"),
                        TestResource::Model("RealmAllocation"),
                    ]
                        .span(),
                }
            ]
                .span(),
        )
    }

    #[test]
    fn paid_reservations_and_repeated_draws_share_one_pool() {
        let mut world = setup();
        let player = 123.try_into().unwrap();
        world.write_model_test(@RealmAllocationPool { game_id: 1, initialized: true, remaining: 3 });
        RealmAllocationImpl::reserve(ref world, 1, 2, player);
        assert!(RealmAllocationImpl::at(world, 1, 1) == 3, "tail was not moved");
        RealmAllocationImpl::reserve(ref world, 1, 3, player);
        assert!(RealmAllocationImpl::at(world, 1, 0) == 1, "last realm was lost");
        RealmAllocationImpl::reserve(ref world, 1, 1, player);
        assert!(RealmAllocationImpl::remaining(world, 1) == 0, "pool did not exhaust");
        assert!(RealmAllocationImpl::remaining(world, 2) == 8000, "allocation crossed games");
    }

    #[test]
    #[should_panic(expected: "Eternum: canonical realm already allocated")]
    fn a_paid_realm_cannot_reuse_an_open_allocation() {
        let mut world = setup();
        let player = 123.try_into().unwrap();
        RealmAllocationImpl::reserve(ref world, 1, 87, player);
        RealmAllocationImpl::reserve(ref world, 1, 87, player);
    }
}
