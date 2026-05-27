use cubit::f128::procgen::simplex3;
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use cubit::f128::types::vec3::Vec3Trait;
use dojo::world::WorldStorage;
use crate::models::config::{BiomeClimateConfig, WorldConfigUtilImpl};
use crate::utils::fixed_constants as fc;
#[derive(Copy, Drop, Serde, Introspect, Debug, PartialEq)]
pub enum Biome {
    None,
    DeepOcean,
    Ocean,
    Beach,
    Scorched,
    Bare,
    Tundra,
    Snow,
    TemperateDesert,
    Shrubland,
    Taiga,
    Grassland,
    TemperateDeciduousForest,
    TemperateRainForest,
    SubtropicalDesert,
    TropicalSeasonalForest,
    TropicalRainForest,
    Underground,
}

impl BiomeIntoFelt252 of Into<Biome, felt252> {
    fn into(self: Biome) -> felt252 {
        match self {
            Biome::None => 'None',
            Biome::DeepOcean => 'Deep Ocean',
            Biome::Ocean => 'Ocean',
            Biome::Beach => 'Beach',
            Biome::Scorched => 'Scorched',
            Biome::Bare => 'Bare',
            Biome::Tundra => 'Tundra',
            Biome::Snow => 'Snow',
            Biome::TemperateDesert => 'Temperate Desert',
            Biome::Shrubland => 'Shrubland',
            Biome::Taiga => 'Taiga',
            Biome::Grassland => 'Grassland',
            Biome::TemperateDeciduousForest => 'Temperate Deciduous Forest',
            Biome::TemperateRainForest => 'Temperate Rain Forest',
            Biome::SubtropicalDesert => 'Subtropical Desert',
            Biome::TropicalSeasonalForest => 'Tropical Seasonal Forest',
            Biome::TropicalRainForest => 'Tropical Rain Forest',
            Biome::Underground => 'Underground',
        }
    }
}


impl BiomeIntoU8 of Into<Biome, u8> {
    fn into(self: Biome) -> u8 {
        match self {
            Biome::None => 0,
            Biome::DeepOcean => 1,
            Biome::Ocean => 2,
            Biome::Beach => 3,
            Biome::Scorched => 4,
            Biome::Bare => 5,
            Biome::Tundra => 6,
            Biome::Snow => 7,
            Biome::TemperateDesert => 8,
            Biome::Shrubland => 9,
            Biome::Taiga => 10,
            Biome::Grassland => 11,
            Biome::TemperateDeciduousForest => 12,
            Biome::TemperateRainForest => 13,
            Biome::SubtropicalDesert => 14,
            Biome::TropicalSeasonalForest => 15,
            Biome::TropicalRainForest => 16,
            Biome::Underground => 17,
        }
    }
}


impl U8IntoBiome of Into<u8, Biome> {
    fn into(self: u8) -> Biome {
        match self {
            0 => Biome::None,
            1 => Biome::DeepOcean,
            2 => Biome::Ocean,
            3 => Biome::Beach,
            4 => Biome::Scorched,
            5 => Biome::Bare,
            6 => Biome::Tundra,
            7 => Biome::Snow,
            8 => Biome::TemperateDesert,
            9 => Biome::Shrubland,
            10 => Biome::Taiga,
            11 => Biome::Grassland,
            12 => Biome::TemperateDeciduousForest,
            13 => Biome::TemperateRainForest,
            14 => Biome::SubtropicalDesert,
            15 => Biome::TropicalSeasonalForest,
            16 => Biome::TropicalRainForest,
            17 => Biome::Underground,
            _ => panic!("invalid biome"),
        }
    }
}


fn bdepth(biome: Biome) -> Fixed {
    match biome {
        Biome::None => FixedTrait::ZERO(),
        Biome::DeepOcean => fc::_0_1(),
        Biome::Ocean => fc::_0_1(),
        Biome::Beach => fc::_0_2(),
        Biome::Scorched => fc::_0_8(),
        Biome::Bare => fc::_0_7(),
        Biome::Tundra => fc::_0_6(),
        Biome::Snow => fc::_0_5(),
        Biome::TemperateDesert => fc::_0_4(),
        Biome::Shrubland => fc::_0_5(),
        Biome::Taiga => fc::_0_6(),
        Biome::Grassland => fc::_0_4(),
        Biome::TemperateDeciduousForest => fc::_0_5(),
        Biome::TemperateRainForest => fc::_0_7(),
        Biome::SubtropicalDesert => fc::_0_3(),
        Biome::TropicalSeasonalForest => fc::_0_5(),
        Biome::TropicalRainForest => fc::_0_6(),
        Biome::Underground => FixedTrait::ZERO(),
    }
}

mod LEVEL {
    use cubit::f128::types::fixed::Fixed;
    use crate::utils::fixed_constants as fc;

    pub fn DEEP_OCEAN() -> Fixed {
        fc::_0_17()
    }

    pub fn OCEAN() -> Fixed {
        fc::_0_26()
    }

    pub fn SAND() -> Fixed {
        fc::_0_31()
    }

    pub fn FOREST() -> Fixed {
        fc::_0_42()
    }

    pub fn DESERT() -> Fixed {
        fc::_0_5()
    }

    pub fn MOUNTAIN() -> Fixed {
        fc::_0_56()
    }
}


fn MAP_AMPLITUDE() -> Fixed {
    FixedTrait::new_unscaled(24, false)
}


fn MOISTURE_OCTAVE() -> Fixed {
    FixedTrait::new_unscaled(5, false)
}

fn ELEVATION_OCTAVES() -> Array<Fixed> {
    array![fc::_1(), fc::_0_2(), fc::_0_083333()]
}


fn ELEVATION_OCTAVES_SUM() -> Fixed {
    let mut octaves = ELEVATION_OCTAVES();
    let mut sum = fc::_0();
    loop {
        match octaves.pop_front() {
            Option::Some(octave) => { sum += octave; },
            Option::None => { break; },
        }
    }
    sum
}

fn CLIMATE_BPS_DENOMINATOR() -> u16 {
    10000
}

fn neutral_biome_climate() -> BiomeClimateConfig {
    BiomeClimateConfig {
        elevation_scale_bps: CLIMATE_BPS_DENOMINATOR(),
        moisture_scale_bps: CLIMATE_BPS_DENOMINATOR(),
        elevation_bias_bps: CLIMATE_BPS_DENOMINATOR(),
        moisture_bias_bps: CLIMATE_BPS_DENOMINATOR(),
    }
}

fn resolve_climate_bps(value: u16) -> u16 {
    if value == 0 {
        CLIMATE_BPS_DENOMINATOR()
    } else {
        value
    }
}

fn climate_bps_to_fixed(value: u16) -> Fixed {
    FixedTrait::new_unscaled(resolve_climate_bps(value).into(), false)
        / FixedTrait::new_unscaled(CLIMATE_BPS_DENOMINATOR().into(), false)
}

fn climate_bias_to_fixed(value: u16) -> Fixed {
    let bps = resolve_climate_bps(value);
    let denominator = CLIMATE_BPS_DENOMINATOR();
    let diff = if bps >= denominator {
        FixedTrait::new_unscaled((bps - denominator).into(), false)
    } else {
        FixedTrait::new_unscaled((denominator - bps).into(), true)
    };
    diff / FixedTrait::new_unscaled(denominator.into(), false)
}

fn apply_climate_adjustment(value: Fixed, scale_bps: u16, bias_bps: u16) -> Fixed {
    clamp_climate_value(value * climate_bps_to_fixed(scale_bps) + climate_bias_to_fixed(bias_bps))
}

fn clamp_climate_value(value: Fixed) -> Fixed {
    if value < fc::_0() {
        fc::_0()
    } else if value > fc::_1() {
        fc::_1()
    } else {
        value
    }
}

pub fn get_biome(alt: bool, col: u128, row: u128) -> Biome {
    get_biome_with_climate(alt, col, row, neutral_biome_climate())
}

pub fn get_biome_from_world(world: WorldStorage, alt: bool, col: u128, row: u128) -> Biome {
    let climate: BiomeClimateConfig = WorldConfigUtilImpl::get_member(world, selector!("biome_climate_config"));
    get_biome_with_climate(alt, col, row, climate)
}

pub fn get_biome_with_climate(alt: bool, col: u128, row: u128, climate: BiomeClimateConfig) -> Biome {
    if alt {
        return Biome::Underground;
    }
    let col_fixed = FixedTrait::new_unscaled(col, false);
    let row_fixed = FixedTrait::new_unscaled(row, false);
    let elevation = apply_climate_adjustment(
        _elevation(col_fixed, row_fixed), climate.elevation_scale_bps, climate.elevation_bias_bps,
    );
    let moisture = apply_climate_adjustment(
        _moisture(col_fixed, row_fixed), climate.moisture_scale_bps, climate.moisture_bias_bps,
    );
    _environment(elevation, moisture)
}


fn _elevation(col: Fixed, row: Fixed) -> Fixed {
    let mut elevation = fc::_0();
    let mut octaves = ELEVATION_OCTAVES();
    let MAP_AMPLITUDE = MAP_AMPLITUDE();
    loop {
        match octaves.pop_front() {
            Option::Some(octave) => {
                let x = (col / octave) / MAP_AMPLITUDE;
                let z = (row / octave) / MAP_AMPLITUDE;
                let vec = Vec3Trait::new(x, fc::_0(), z);
                let noise = ((simplex3::noise(vec) + fc::_1()) * fc::_100()) / fc::_2();
                elevation += octave * noise.floor();
            },
            Option::None => { break; },
        }
    }

    elevation = elevation / ELEVATION_OCTAVES_SUM();
    elevation = elevation / fc::_100();
    elevation
}


fn _moisture(col: Fixed, row: Fixed) -> Fixed {
    let MOISTURE_OCTAVE = MOISTURE_OCTAVE();
    let MAP_AMPLITUDE = MAP_AMPLITUDE();
    let moisture_x = (MOISTURE_OCTAVE * col) / MAP_AMPLITUDE;
    let moisture_z = (MOISTURE_OCTAVE * row) / MAP_AMPLITUDE;
    let vec = Vec3Trait::new(moisture_x, fc::_0(), moisture_z);
    let noise = ((simplex3::noise(vec) + fc::_1()) * fc::_100()) / fc::_2();
    let moisture = noise.floor() / fc::_100();
    moisture
}


fn _environment(elevation: Fixed, moisture: Fixed) -> Biome {
    let biome = if elevation < LEVEL::DEEP_OCEAN() {
        Biome::DeepOcean
    } else if elevation < LEVEL::OCEAN() {
        Biome::Ocean
    } else if elevation < LEVEL::SAND() {
        Biome::Beach
    } else if elevation > LEVEL::MOUNTAIN() {
        if moisture < fc::_0_35() {
            Biome::Scorched
        } else if moisture < fc::_0_45() {
            Biome::Bare
        } else if moisture < fc::_0_6() {
            Biome::Tundra
        } else {
            Biome::Snow
        }
    } else if elevation > LEVEL::DESERT() {
        if moisture < fc::_0_4() {
            Biome::TemperateDesert
        } else if moisture < fc::_0_6() {
            Biome::Shrubland
        } else {
            Biome::Taiga
        }
    } else if elevation > LEVEL::FOREST() {
        if moisture < fc::_0_3() {
            Biome::TemperateDesert
        } else if moisture < fc::_0_45() {
            Biome::Grassland
        } else if moisture < fc::_0_6() {
            Biome::TemperateDeciduousForest
        } else {
            Biome::TemperateRainForest
        }
    } else {
        if moisture < fc::_0_4() {
            Biome::SubtropicalDesert
        } else if moisture < fc::_0_45() {
            Biome::Grassland
        } else if moisture < fc::_0_62() {
            Biome::TropicalSeasonalForest
        } else {
            Biome::TropicalRainForest
        }
    };

    return biome;
}


#[cfg(test)]
mod tests {
    // use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use crate::models::config::BiomeClimateConfig;
    use crate::utils::map::biomes::Biome;
    use super::{get_biome, get_biome_with_climate};

    // #[test]
    // #[available_gas(9000000000000000000)]
    // fn test_biome_generation() {
    //     println!("[");
    //     let start = 7785456456650;
    //     let end = start + 50_000;
    //     let mut i = start;
    //     loop {
    //         if i > end {
    //             break;
    //         }
    //         let x = i - 5;
    //         let z = i + 10;
    //         let biome = get_biome(x, z);
    //         // Print JSON object with comma for all entries except the last one
    //         if i != end {
    //             println!("  {{ \"x\": \"{:?}\", \"z\": \"{:?}\", \"biome\": \"{:?}\" }},", x, z, biome);
    //         } else {
    //             println!("  {{ \"x\": \"{:?}\", \"z\": \"{:?}\", \"biome\": \"{:?}\" }}", x, z, biome);
    //         }
    //         i += 1;
    //     };
    //     println!("]");
    // }

    #[test]
    fn test_noisy() {
        get_biome(false, 1128, 389);
    }

    #[test]
    fn test_neutral_climate_matches_default_biome_generation() {
        let climate = BiomeClimateConfig {
            elevation_scale_bps: 10000, moisture_scale_bps: 10000, elevation_bias_bps: 10000, moisture_bias_bps: 10000,
        };

        let default_biome = get_biome(false, 0, 0);
        let neutral_biome = get_biome_with_climate(false, 0, 0, climate);

        assert!(neutral_biome == default_biome, "neutral climate changed biome");
        assert!(neutral_biome == Biome::Beach, "neutral fixture changed");
    }

    #[test]
    fn test_climate_adjusts_biome_generation() {
        let snowy_climate = BiomeClimateConfig {
            elevation_scale_bps: 10000, moisture_scale_bps: 10000, elevation_bias_bps: 20000, moisture_bias_bps: 20000,
        };
        let deep_ocean_climate = BiomeClimateConfig {
            elevation_scale_bps: 10000, moisture_scale_bps: 10000, elevation_bias_bps: 1, moisture_bias_bps: 1,
        };

        assert!(get_biome_with_climate(false, 0, 0, snowy_climate) == Biome::Snow, "wet high climate should snow");
        assert!(
            get_biome_with_climate(false, 0, 0, deep_ocean_climate) == Biome::DeepOcean,
            "low climate should deep ocean",
        );
    }

    #[test]
    fn test_zero_climate_values_are_neutral() {
        let climate = BiomeClimateConfig {
            elevation_scale_bps: 0, moisture_scale_bps: 0, elevation_bias_bps: 0, moisture_bias_bps: 0,
        };

        assert!(get_biome_with_climate(false, 0, 0, climate) == Biome::Beach, "zero climate should be neutral");
    }
}
