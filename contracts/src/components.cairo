mod config;
mod age;
mod position;
mod realm;
mod resources;
mod labor;
mod owner;
mod capacity;
mod movable;
mod quantity;
mod metadata;
mod caravan;
mod trade;


trait ComponentManagerTrait<T,U> {
    fn get(self: T) -> U;
    fn set(self: T, value: U);
}

trait ComponentExistsTrait<T> {
    fn exists(self: T) -> bool;
}

