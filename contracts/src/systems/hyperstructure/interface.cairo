use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait IHyperstructureSystems {
    fn control(hyperstructure_id: ID, order_id: u8);
    fn complete(hyperstructure_id: ID);
}
