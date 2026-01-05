use crate::utils::map::biomes::Biome;
#[starknet::interface]
pub trait IBiomeLibrary<T> {
    fn get_biome(self: @T, alt: bool, col: u128, row: u128) -> Biome;
}


#[dojo::library]
mod biome_library {
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use crate::utils::map::biomes::{Biome, get_biome};

    #[abi(embed_v0)]
    pub impl BiomeLibraryImpl of super::IBiomeLibrary<ContractState> {
        fn get_biome(self: @ContractState, alt: bool, col: u128, row: u128) -> Biome {
            get_biome(alt, col, row)
        }
    }

    pub fn get_dispatcher(world: @WorldStorage) -> super::IBiomeLibraryLibraryDispatcher {
        let (_, class_hash) = world.dns(@"biome_library_v0_1_5").expect('biome_library not found');
        super::IBiomeLibraryLibraryDispatcher { class_hash }
    }
}
