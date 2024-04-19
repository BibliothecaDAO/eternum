// Settlement is like a Realm, but it has a cost to create and a tax to maintain
// if tax is not paid, then the owner of the hyperstructure that the settlement is built on can claim the settlement

// ----- Settlement models
// Settlement -> Details around settlement
// Entity Balance -> Balance of Entity at location
// Entity Type -> Type of Entity at location
// Position -> Position of Entity at location
// Owner -> Owner of Entity at location

// #[derive(Model, Copy, Drop, Serde)]
// struct Settlement {
//     #[key]
//     entity_id: u128,
//     resource_types_packed: u128,
//     resource_types_count: u8,
//     order: u8,
//     last_time_tax_paid: u64, // rent plot in lords
// }

// #[derive(Model, Copy, Drop, Serde)]
// struct Structure<T> {
//     #[key]
//     entity_id: u128,
//     structure_type: u8,
//     last_time_tax_paid: u64,
// }

// #[derive(Model, Copy, Drop, Serde)]
// struct StructureTax<T> {
//     #[key]
//     entity_id: u128,
//     order: u8,
//     last_time_tax_paid: u64,
// }

// trait StructuresTrait<T> {
//     fn construct(self: Structure<T>);
//     fn destruct(self: Structure<T>);
//     fn pay_tax(self: Structure<T>);
// }

// impl StructuresImpl<T, +Copy<T>, T, +Drop<T>> of StructuresTrait<T> {
//     fn construct(self: Structure<T>) {}
//     fn destruct(self: Structure<T>) {}
//     fn pay_tax(self: Structure<T>) {}
// }

// #[derive(Model, Copy, Drop, Serde)]
// struct Settlement<T> {
//     #[key]
//     entity_id: u128,
//     structure_type: u8,
//     last_time_tax_paid: u64,
// }


