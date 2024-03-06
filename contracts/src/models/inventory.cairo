use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::metadata::ForeignKey;

#[derive(Model, Copy, Drop, Serde)]
struct Inventory {
    #[key]
    entity_id: u128,
    items_key: felt252,
    items_count: u128,
}

#[generate_trait]
impl InventoryImpl of InventoryTrait {
    fn item_fk(self: Inventory, world: IWorldDispatcher, item_index: u128) -> ForeignKey {
        let foreign_key_arr: Array<felt252> = array![
            self.entity_id.into(), self.items_key.into(), item_index.into()
        ];
        let foreign_key_id: felt252 = core::poseidon::poseidon_hash_span(foreign_key_arr.span());
        let foreign_key: ForeignKey = get!(world, foreign_key_id, ForeignKey);

        return foreign_key;
    }

    fn item_id(self: Inventory, world: IWorldDispatcher, item_index: u128) -> u128 {
        self.item_fk(world, item_index).entity_id
    }


    fn last_item_fk(self: Inventory, world: IWorldDispatcher) -> ForeignKey {
        self.item_fk(world, self.items_count - 1)
    }

    fn last_item_id(self: Inventory, world: IWorldDispatcher) -> u128 {
        self.last_item_fk(world).entity_id
    }

    fn next_item_fk(self: Inventory, world: IWorldDispatcher) -> ForeignKey {
        // next_item_fk.entity_id should always be 0
        self.item_fk(world, self.items_count)
    }

    fn set_next_item(ref self: Inventory, world: IWorldDispatcher, item_id: u128) {
        // next_item_fk.entity_id should always be 0
        let mut next_item_fk = self.next_item_fk(world);
        // assert(next_item_fk.entity_id == 0, 'wrong next item fk');
        next_item_fk.entity_id = item_id;

        set!(world, (next_item_fk));

        // update inventory item count
        self.items_count += 1;
        set!(world, (self));
    }
}
