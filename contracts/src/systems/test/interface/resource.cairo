use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait IResourceSystems {
    fn mint(entity_id: u128, resources: Span<(u8, u128)>,);
}
