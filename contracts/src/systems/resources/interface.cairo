use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait IResourceSystems {
    fn approve(entity_id: ID, approved_entity_id: ID, resources: Span<(u8, u128)>);
    fn transfer(sending_entity_id: ID, receiving_entity_id: ID, resources: Span<(u8, u128)>);

    fn transfer_from(
        approved_entity_id: ID,
        owner_entity_id: ID,
        receiving_entity_id: ID,
        resources: Span<(u8, u128)>
    );
}

#[dojo::interface]
trait IInventorySystems {
    fn transfer_item(sender_id: ID, index: u128, receiver_id: ID);
}
