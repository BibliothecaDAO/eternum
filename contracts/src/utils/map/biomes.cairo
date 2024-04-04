#[derive(Copy, Drop, Serde, Introspect)]
enum Biome {
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
}

impl BiomeIntoFelt252 of Into<Biome, felt252> {
    fn into(self: Biome) -> felt252 {
        match self {
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
        }
    }
}

use eternum::utils::map::constants::fixed_constants as fc;
fn bdepth(biome: Biome) -> Fixed {
    match biome {
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
    }
}

mod LEVEL {
    use cubit::f128::types::fixed::{FixedTrait, Fixed, ONE_u128};
    use eternum::utils::map::constants::fixed_constants as fc;

    fn DEEP_OCEAN() -> Fixed {
        fc::_0_25()
    }

    fn OCEAN() -> Fixed {
        fc::_0_5()
    }

    fn SAND() -> Fixed {
        fc::_0_53()
    }

    fn FOREST() -> Fixed {
        fc::_0_6()
    }

    fn DESERT() -> Fixed {
        fc::_0_72()
    }

    fn MOUNTAIN() -> Fixed {
        fc::_0_8()
    }
}

use cubit::f128::procgen::simplex3;
use cubit::f128::types::fixed::{FixedTrait, Fixed};
use cubit::f128::types::vec3::{Vec3, Vec3Trait};


fn MAP_AMPLITUDE() -> Fixed {
    FixedTrait::new_unscaled(60, false)
}


fn MOISTURE_OCTAVE() -> Fixed {
    fc::_2()
}

fn ELEVATION_OCTAVES() -> Array<Fixed> {
    array![fc::_1(), fc::_0_25(), fc::_0_1()]
}


fn ELEVATION_OCTAVES_SUM() -> Fixed {
    let mut octaves = ELEVATION_OCTAVES();
    let mut sum = fc::_0();
    loop {
        match octaves.pop_front() {
            Option::Some(octave) => { sum += octave; },
            Option::None => { break; },
        }
    };
    sum
}


fn get_biome(col: u128, row: u128) -> Biome {
    let col_fixed = FixedTrait::new_unscaled(col, false);
    let row_fixed = FixedTrait::new_unscaled(row, false);
    let elevation = _elevation(col_fixed, row_fixed);
    let moisture = _moisture(col_fixed, row_fixed);
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
    };

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
        if moisture < fc::_0_1() {
            Biome::Scorched
        } else if moisture < fc::_0_4() {
            Biome::Bare
        } else if moisture < fc::_0_5() {
            Biome::Tundra
        } else {
            Biome::Snow
        }
    } else if elevation > LEVEL::DESERT() {
        if moisture < fc::_0_33() {
            Biome::TemperateDesert
        } else if moisture < fc::_0_66() {
            Biome::Shrubland
        } else {
            Biome::Taiga
        }
    } else if elevation > LEVEL::FOREST() {
        if moisture < fc::_0_16() {
            Biome::TemperateDesert
        } else if moisture < fc::_0_5() {
            Biome::Grassland
        } else if moisture < fc::_0_83() {
            Biome::TemperateDeciduousForest
        } else {
            Biome::TemperateRainForest
        }
    } else {
        if moisture < fc::_0_16() {
            Biome::SubtropicalDesert
        } else if moisture < fc::_0_33() {
            Biome::Grassland
        } else if moisture < fc::_0_66() {
            Biome::TropicalSeasonalForest
        } else {
            Biome::TropicalRainForest
        }
    };

    return biome;
}


#[cfg(test)]
mod tests {
    use cubit::f128::types::fixed::{FixedTrait, Fixed};
    use super::get_biome;

    #[test]
    fn test_noisy() {
        get_biome(1128, 389);
    }
}
