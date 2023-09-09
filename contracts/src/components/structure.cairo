#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Structure {
    #[key]
    entity_id: u128,
    structure_type: u8
}

#[derive(Copy, Drop, Serde)]
struct StructureMaterial {
    resource_type: u8,
    amount: u128
}


mod StructureType {
    const Thornhaven: u8 = 1;
    const Celestia: u8 = 2;
    const Verdigris: u8 = 3;
    const Obsidiora: u8 = 4;
    const Eldertide: u8 = 5;
    const Sablecroft: u8 = 6;
    const Glimmerwynd: u8 = 7;
    const Amberspire: u8 = 8;
    const Argentum: u8 = 9;
    const Moonshadow: u8 = 10;
    const Ravenspire: u8 = 11;
    const Thundertop: u8 = 12;
    const Starhaven: u8 = 13;
    const Mariglow: u8 = 14;
    const Ironhold: u8 = 15;
    const Crystalline: u8 = 16;
}