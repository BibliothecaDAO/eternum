use eternum::alias::ID;
use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait IHyperstructureSystems {
    fn control(hyperstructure_id: ID, order_id: u8);
    fn complete(hyperstructure_id: ID);
}
